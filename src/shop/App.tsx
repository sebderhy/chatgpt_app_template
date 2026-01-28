/**
 * Shop/Cart Widget Template
 *
 * E-commerce cart with checkout flow - perfect for:
 * - Product catalogs
 * - Shopping carts
 * - Order summaries
 * - Checkout flows
 */

import React, { useState, useMemo, useCallback } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Minus, Plus, ShoppingCart, X } from "lucide-react";
import { useWidgetProps } from "../use-widget-props";
import { useWidgetState } from "../use-widget-state";
import { useDisplayMode } from "../use-display-mode";

type NutritionFact = {
  label: string;
  value: string;
};

type CartItem = {
  id: string;
  name: string;
  price: number;
  description: string;
  shortDescription?: string;
  detailSummary?: string;
  nutritionFacts?: NutritionFact[];
  highlights?: string[];
  tags?: string[];
  quantity: number;
  image: string;
};

type ToolOutput = {
  title?: string;
  cartItems: CartItem[];
};

type WidgetState = {
  cartItems: CartItem[];
  selectedItemId: string | null;
  isCheckout: boolean;
};

const SERVICE_FEE = 3;
const DELIVERY_FEE = 2.99;
const TAX_FEE = 3.4;

const FILTERS = [
  { id: "all", label: "All" },
  { id: "vegetarian", label: "Vegetarian", tag: "vegetarian" },
  { id: "vegan", label: "Vegan", tag: "vegan" },
  { id: "spicy", label: "Spicy", tag: "spicy" },
] as const;

const defaultCartItems: CartItem[] = [
  {
    id: "marys-chicken",
    name: "Mary's Chicken",
    price: 19.48,
    description: "Tender organic chicken breasts trimmed for easy cooking. Raised without antibiotics and air chilled for exceptional flavor.",
    shortDescription: "Organic chicken breasts",
    detailSummary: "4 lbs - $3.99/lb",
    nutritionFacts: [
      { label: "Protein", value: "8g" },
      { label: "Fat", value: "9g" },
      { label: "Sugar", value: "12g" },
      { label: "Calories", value: "160" },
    ],
    highlights: [
      "No antibiotics or added hormones.",
      "Air chilled and never frozen for peak flavor.",
      "Raised in the USA on a vegetarian diet.",
    ],
    quantity: 2,
    image: "https://persistent.oaistatic.com/pizzaz-cart-xl/chicken.png",
    tags: ["size"],
  },
  {
    id: "avocados",
    name: "Avocados",
    price: 1,
    description: "Creamy Hass avocados picked at peak ripeness. Ideal for smashing into guacamole or topping tacos.",
    shortDescription: "Creamy Hass avocados",
    detailSummary: "3 ct - $1.00/ea",
    nutritionFacts: [
      { label: "Fiber", value: "7g" },
      { label: "Fat", value: "15g" },
      { label: "Potassium", value: "485mg" },
      { label: "Calories", value: "160" },
    ],
    highlights: [
      "Perfectly ripe and ready for slicing.",
      "Rich in healthy fats and naturally creamy.",
    ],
    quantity: 2,
    image: "https://persistent.oaistatic.com/pizzaz-cart-xl/avocado.png",
    tags: ["vegan"],
  },
  {
    id: "hojicha-pizza",
    name: "Hojicha Pizza",
    price: 15.5,
    description: "Wood-fired crust layered with smoky hojicha tea sauce and melted mozzarella with a drizzle of honey for an adventurous slice.",
    shortDescription: "Smoky hojicha sauce & honey",
    detailSummary: '12" pie - Serves 2',
    nutritionFacts: [
      { label: "Protein", value: "14g" },
      { label: "Fat", value: "18g" },
      { label: "Sugar", value: "9g" },
      { label: "Calories", value: "320" },
    ],
    highlights: [
      "Smoky roasted hojicha glaze with honey drizzle.",
      "Stone-fired crust with a delicate char.",
    ],
    quantity: 2,
    image: "https://persistent.oaistatic.com/pizzaz-cart-xl/hojicha-pizza.png",
    tags: ["vegetarian", "spicy"],
  },
  {
    id: "chicken-pizza",
    name: "Chicken Pizza",
    price: 7,
    description: "Classic thin-crust pizza topped with roasted chicken, caramelized onions, and herb pesto.",
    shortDescription: "Roasted chicken & pesto",
    detailSummary: '10" personal - Serves 1',
    nutritionFacts: [
      { label: "Protein", value: "20g" },
      { label: "Fat", value: "11g" },
      { label: "Carbs", value: "36g" },
      { label: "Calories", value: "290" },
    ],
    highlights: [
      "Roasted chicken with caramelized onions.",
      "Fresh basil pesto and mozzarella.",
    ],
    quantity: 1,
    image: "https://persistent.oaistatic.com/pizzaz-cart-xl/chicken-pizza.png",
    tags: [],
  },
  {
    id: "matcha-pizza",
    name: "Matcha Pizza",
    price: 5,
    description: "Crisp dough spread with velvety matcha cream and mascarpone. Earthy green tea notes balance gentle sweetness.",
    shortDescription: "Velvety matcha cream",
    detailSummary: '8" dessert - Serves 2',
    nutritionFacts: [
      { label: "Protein", value: "6g" },
      { label: "Fat", value: "10g" },
      { label: "Sugar", value: "14g" },
      { label: "Calories", value: "240" },
    ],
    highlights: [
      "Stone-baked crust with delicate crunch.",
      "Matcha mascarpone with white chocolate drizzle.",
    ],
    quantity: 1,
    image: "https://persistent.oaistatic.com/pizzaz-cart-xl/matcha-pizza.png",
    tags: ["vegetarian"],
  },
  {
    id: "pesto-pizza",
    name: "Pesto Pizza",
    price: 12.5,
    description: "Hand-tossed crust brushed with bright basil pesto, layered with fresh mozzarella, and finished with roasted cherry tomatoes.",
    shortDescription: "Basil pesto & tomatoes",
    detailSummary: '12" pie - Serves 2',
    nutritionFacts: [
      { label: "Protein", value: "16g" },
      { label: "Fat", value: "14g" },
      { label: "Carbs", value: "28g" },
      { label: "Calories", value: "310" },
    ],
    highlights: [
      "House-made pesto with sweet basil and pine nuts.",
      "Roasted cherry tomatoes for a pop of acidity.",
    ],
    quantity: 1,
    image: "https://persistent.oaistatic.com/pizzaz-cart-xl/matcha-pizza.png",
    tags: ["vegetarian"],
  },
];

const defaultProps: ToolOutput = {
  title: "Your Cart",
  cartItems: defaultCartItems,
};

/* -------------------------------- Selected Item Panel ------------------------------- */
function SelectedItemPanel({
  item,
  onAdjustQuantity,
  onClose,
}: {
  item: CartItem;
  onAdjustQuantity: (id: string, delta: number) => void;
  onClose: () => void;
}) {
  const nutritionFacts = item.nutritionFacts ?? [];
  const highlights = item.highlights ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-4"
    >
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{item.name}</h3>
        <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-full">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
        <div className="relative flex items-center justify-center overflow-hidden bg-gray-50">
          <img
            src={item.image}
            alt={item.name}
            className="max-h-[200px] w-[80%] object-cover"
          />
        </div>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0">
          <p className="text-xl font-medium text-black">${item.price.toFixed(2)}</p>
          {item.detailSummary && (
            <p className="text-sm text-black/60">{item.detailSummary}</p>
          )}
        </div>
        <div className="flex items-center rounded-full bg-black/[0.04] px-1 py-1 text-black">
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-slate-200"
            onClick={() => onAdjustQuantity(item.id, -1)}
          >
            <Minus strokeWidth={2} className="h-3.5 w-3.5" />
          </button>
          <span className="mx-2 min-w-[10px] text-center text-base font-medium">
            {item.quantity}
          </span>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-slate-200"
            onClick={() => onAdjustQuantity(item.id, 1)}
          >
            <Plus strokeWidth={2} className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <p className="text-sm text-black/60">{item.description}</p>

      {nutritionFacts.length > 0 && (
        <div className="grid grid-cols-4 gap-2 rounded-2xl border border-black/[0.05] px-3 py-2 text-center">
          {nutritionFacts.map((fact) => (
            <div key={fact.label} className="space-y-0.5">
              <p className="text-sm font-medium text-black">{fact.value}</p>
              <p className="text-xs text-black/60">{fact.label}</p>
            </div>
          ))}
        </div>
      )}

      {highlights.length > 0 && (
        <div className="space-y-1 text-sm text-black/60">
          {highlights.map((highlight, index) => (
            <p key={index}>- {highlight}</p>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* -------------------------------- Checkout Panel ------------------------------- */
function CheckoutPanel({
  subtotal,
  total,
  onContinue,
}: {
  subtotal: number;
  total: number;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Checkout Details</h2>

      <section className="space-y-3 border-t border-black/5 pt-3">
        <div>
          <h3 className="text-sm font-medium">Delivery address</h3>
          <p className="text-sm text-black/70 mt-1">1234 Main St, San Francisco, CA</p>
          <p className="text-xs text-black/50">Leave at door</p>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 p-3 rounded-xl border-2 border-black bg-black/5">
            <p className="text-sm font-medium">Fast</p>
            <p className="text-xs text-black/50">50 min - 2 hr</p>
            <span className="text-xs font-semibold text-green-700">Free</span>
          </div>
          <div className="flex-1 p-3 rounded-xl border border-black/10">
            <p className="text-sm font-medium">Priority</p>
            <p className="text-xs text-black/50">35 min</p>
            <span className="text-xs font-semibold text-green-700">$2.99</span>
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-black/5 pt-3">
        <div>
          <h3 className="text-sm font-medium text-black">Delivery tip</h3>
          <p className="text-xs text-black/50">100% goes to the shopper</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {["5%", "10%", "15%", "Other"].map((tip, i) => (
            <button
              key={tip}
              type="button"
              className={`flex-1 rounded-full py-2 ${
                i === 1
                  ? "bg-black text-white font-medium"
                  : "bg-black/5 text-slate-600"
              }`}
            >
              {tip}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-1 border-t border-black/5 pt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-black/70">Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-black/70">Service fee</span>
          <span>${SERVICE_FEE.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-black/70">Delivery</span>
          <span>${DELIVERY_FEE.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-black/70">Tax</span>
          <span>${TAX_FEE.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between font-medium pt-2 border-t border-black/5">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </section>

      <button
        type="button"
        onClick={onContinue}
        className="w-full rounded-full bg-orange-500 hover:bg-orange-600 px-6 py-3 font-medium text-white transition-colors"
      >
        Continue to payment
      </button>
    </div>
  );
}

/* -------------------------------- Main App ------------------------------- */
export default function App() {
  const props = useWidgetProps<ToolOutput>(defaultProps);
  const displayMode = useDisplayMode() ?? "inline";
  const isFullscreen = displayMode === "fullscreen";

  const [widgetState, setWidgetState] = useWidgetState<WidgetState>({
    cartItems: props.cartItems,
    selectedItemId: null,
    isCheckout: false,
  });

  const cartItems = widgetState?.cartItems ?? props.cartItems;
  const selectedItemId = widgetState?.selectedItemId ?? null;
  const isCheckout = widgetState?.isCheckout ?? false;

  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  const adjustQuantity = useCallback((id: string, delta: number) => {
    setWidgetState((prev) => {
      const currentItems = prev?.cartItems ?? cartItems;
      return {
        cartItems: currentItems.map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        ),
        selectedItemId: prev?.selectedItemId ?? null,
        isCheckout: prev?.isCheckout ?? false,
      };
    });
  }, [setWidgetState, cartItems]);

  const selectItem = useCallback((id: string | null) => {
    setWidgetState((prev) => ({
      cartItems: prev?.cartItems ?? cartItems,
      selectedItemId: id,
      isCheckout: false,
    }));
  }, [setWidgetState, cartItems]);

  const toggleCheckout = useCallback(() => {
    setWidgetState((prev) => ({
      cartItems: prev?.cartItems ?? cartItems,
      isCheckout: !(prev?.isCheckout ?? false),
      selectedItemId: null,
    }));
  }, [setWidgetState, cartItems]);

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * Math.max(0, item.quantity), 0),
    [cartItems]
  );

  const total = subtotal + SERVICE_FEE + DELIVERY_FEE + TAX_FEE;

  const totalItems = useMemo(
    () => cartItems.reduce((sum, item) => sum + Math.max(0, item.quantity), 0),
    [cartItems]
  );

  const visibleCartItems = useMemo(() => {
    if (activeFilter === "all") return cartItems;
    const filterMeta = FILTERS.find((f) => f.id === activeFilter);
    if (!filterMeta || !("tag" in filterMeta)) return cartItems;
    return cartItems.filter((item) => item.tags?.includes(filterMeta.tag!));
  }, [activeFilter, cartItems]);

  const selectedItem = selectedItemId
    ? cartItems.find((item) => item.id === selectedItemId)
    : null;

  const handleRequestFullscreen = () => {
    if (window.openai?.requestDisplayMode) {
      window.openai?.requestDisplayMode({ mode: "fullscreen" });
    } else if (window.webplus?.requestDisplayMode) {
      window.webplus?.requestDisplayMode({ mode: "fullscreen" });
    }
  };

  const handleContinueToPayment = () => {
    window.openai?.sendFollowUpMessage?.({ prompt: "Process my order and complete checkout" });
  };

  return (
    <div className={`w-full ${isFullscreen ? "min-h-screen" : ""} bg-gray-50 rounded-2xl border border-black/10 overflow-hidden`}>
      {/* Header */}
      <header className="flex items-center justify-between gap-3 p-4 border-b border-black/5 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleCheckout}
            className="flex items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 text-sm font-medium text-black/70 hover:border-black/40 hover:text-black transition-colors"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>Cart ({totalItems})</span>
          </button>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          {FILTERS.map((filter) => {
            const isActive = filter.id === activeFilter;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-black bg-black text-white"
                    : "border-black/10 text-black/70 hover:border-black/40 hover:text-black"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </nav>
      </header>

      <div className={`flex ${isFullscreen ? "flex-row" : "flex-col"}`}>
        {/* Products Grid */}
        <div className={`${isFullscreen && (selectedItem || isCheckout) ? "flex-1" : "w-full"} p-4`}>
          <LayoutGroup id="products-grid">
            <div className={`grid gap-4 ${isFullscreen ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}>
              <AnimatePresence initial={false} mode="popLayout">
                {visibleCartItems.map((item) => {
                  const isHovered = hoveredItemId === item.id;
                  const shortDescription = item.shortDescription ?? item.description.split(".")[0];

                  return (
                    <motion.article
                      layout
                      layoutId={item.id}
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 260, damping: 26, mass: 0.8 }}
                      onClick={() => selectItem(item.id)}
                      onMouseEnter={() => setHoveredItemId(item.id)}
                      onMouseLeave={() => setHoveredItemId(null)}
                      className={`group cursor-pointer flex flex-col overflow-hidden bg-white rounded-2xl border transition-colors ${
                        isHovered ? "border-teal-600" : "border-transparent"
                      }`}
                    >
                      <div className="relative overflow-hidden rounded-t-2xl bg-gray-100">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-40 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/[0.03]" />
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                          <p className="text-sm text-black/60">${item.price.toFixed(2)}</p>
                        </div>
                        {shortDescription && (
                          <p className="text-xs text-black/50 line-clamp-2">{shortDescription}</p>
                        )}
                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex items-center rounded-full bg-black/[0.04] px-1 py-0.5">
                            <button
                              type="button"
                              className="flex h-5 w-5 items-center justify-center rounded-full opacity-50 hover:bg-slate-200 hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                adjustQuantity(item.id, -1);
                              }}
                            >
                              <Minus strokeWidth={2.5} className="h-3 w-3" />
                            </button>
                            <span className="min-w-[16px] px-1 text-center text-xs font-medium">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              className="flex h-5 w-5 items-center justify-center rounded-full opacity-50 hover:bg-slate-200 hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                adjustQuantity(item.id, 1);
                              }}
                            >
                              <Plus strokeWidth={2.5} className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
          </LayoutGroup>

          {!isFullscreen && (
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={handleRequestFullscreen}
                className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-black/70 hover:border-black/40 hover:text-black transition-colors"
              >
                See all items
              </button>
            </div>
          )}
        </div>

        {/* Side Panel */}
        {isFullscreen && (selectedItem || isCheckout) && (
          <div className="w-80 border-l border-black/5 bg-white p-4 overflow-auto">
            <AnimatePresence mode="wait">
              {selectedItem && !isCheckout && (
                <SelectedItemPanel
                  key="item-panel"
                  item={selectedItem}
                  onAdjustQuantity={adjustQuantity}
                  onClose={() => selectItem(null)}
                />
              )}
              {isCheckout && (
                <motion.div
                  key="checkout-panel"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <CheckoutPanel
                    subtotal={subtotal}
                    total={total}
                    onContinue={handleContinueToPayment}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer - Cart Summary */}
      {!isCheckout && (
        <footer className="border-t border-black/5 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black/60">{totalItems} items</p>
              <p className="text-lg font-semibold">${subtotal.toFixed(2)}</p>
            </div>
            <button
              type="button"
              onClick={toggleCheckout}
              className="rounded-full bg-orange-500 hover:bg-orange-600 px-6 py-2 font-medium text-white transition-colors"
            >
              Checkout
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
