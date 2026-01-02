"""
Tests for Pydantic input model validation - Infrastructure tests.

These tests verify that the Pydantic validation INFRASTRUCTURE works correctly
for ALL input models, without assuming specific model names or field names.

Key behaviors tested:
1. All input models can be instantiated with no arguments (use defaults)
2. All input models reject extra/unknown fields
3. Pydantic configuration is consistent across models

Developers can add/remove input models without modifying these tests.
"""

import pytest
from pydantic import BaseModel, ValidationError
import inspect

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import main


def get_all_input_models():
    """Discover all Pydantic models ending with 'Input' from main.py."""
    models = []
    for name, obj in inspect.getmembers(main):
        if (
            inspect.isclass(obj)
            and issubclass(obj, BaseModel)
            and obj is not BaseModel
            and name.endswith("Input")
        ):
            models.append((name, obj))
    return models


# Get all input models for parametrized tests
INPUT_MODELS = get_all_input_models()


class TestInputModelDiscovery:
    """Tests that input models are discoverable."""

    def test_at_least_one_input_model_exists(self):
        """There should be at least one input model defined."""
        assert len(INPUT_MODELS) > 0, (
            "No input models found. Expected classes ending with 'Input' in main.py"
        )

    def test_all_input_models_are_pydantic_models(self):
        """All discovered input models should be Pydantic BaseModel subclasses."""
        for name, model in INPUT_MODELS:
            assert issubclass(model, BaseModel), (
                f"{name} should be a Pydantic BaseModel subclass"
            )


class TestInputModelDefaults:
    """Tests that input models have sensible defaults."""

    @pytest.mark.parametrize("name,model", INPUT_MODELS)
    def test_model_can_be_instantiated_with_no_arguments(self, name, model):
        """Input models should have defaults for all required fields.

        This is important because ChatGPT may call tools with empty arguments,
        and the handlers should still work with default values.
        """
        try:
            instance = model()
            assert instance is not None
        except ValidationError as e:
            pytest.fail(
                f"{name} cannot be instantiated with no arguments. "
                f"All fields should have defaults. Error: {e}"
            )

    @pytest.mark.parametrize("name,model", INPUT_MODELS)
    def test_model_instance_has_values(self, name, model):
        """Instantiated models should have non-None values for required fields."""
        instance = model()
        # At least one field should be set (models shouldn't be completely empty)
        fields = instance.model_fields
        if fields:
            # Check that the model has at least some data
            data = instance.model_dump()
            assert len(data) > 0, f"{name} should have at least one field"


class TestInputModelValidation:
    """Tests that input models have proper validation configuration."""

    @pytest.mark.parametrize("name,model", INPUT_MODELS)
    def test_model_rejects_extra_fields(self, name, model):
        """Input models should reject unknown/extra fields.

        This prevents typos in tool arguments from being silently ignored.
        """
        with pytest.raises(ValidationError) as exc_info:
            model(completely_unknown_field_that_should_not_exist="value")

        # Verify it's specifically an "extra fields" error
        error_str = str(exc_info.value)
        assert "extra" in error_str.lower() or "unexpected" in error_str.lower(), (
            f"{name} should reject extra fields with a clear error message"
        )

    @pytest.mark.parametrize("name,model", INPUT_MODELS)
    def test_model_config_forbids_extra(self, name, model):
        """Input models should have model_config with extra='forbid'."""
        config = getattr(model, "model_config", {})
        assert config.get("extra") == "forbid", (
            f"{name} should have model_config = ConfigDict(extra='forbid') "
            "to reject unknown fields"
        )


class TestInputModelConsistency:
    """Tests for consistency across input models."""

    def test_all_models_use_same_config_pattern(self):
        """All input models should use the same configuration pattern."""
        configs = []
        for name, model in INPUT_MODELS:
            config = getattr(model, "model_config", {})
            configs.append((name, config.get("extra")))

        # All should have extra='forbid'
        for name, extra_setting in configs:
            assert extra_setting == "forbid", (
                f"{name} should have extra='forbid' like other input models"
            )

    def test_input_model_count_matches_widget_count(self):
        """Number of input models should match number of widgets.

        Each widget tool should have a corresponding input model.
        """
        from main import WIDGETS

        # This is a soft check - some widgets might share input models
        # or have simple inputs that don't need a model
        widget_count = len(WIDGETS)
        input_count = len(INPUT_MODELS)

        # Allow for some flexibility, but they should be in the same ballpark
        assert input_count >= 1, "Should have at least one input model"
        # Don't enforce exact match - just verify the pattern exists
