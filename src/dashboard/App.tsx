/**
 * Dashboard Widget Template
 *
 * Stats and metrics display - perfect for:
 * - Analytics dashboards
 * - KPI summaries
 * - Account overviews
 * - Progress tracking
 */

import React from "react";
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  ShoppingCart,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  BarChart3,
} from "lucide-react";
import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { useWidgetProps } from "../use-widget-props";
import { useTheme } from "../use-theme";
import { useDisplayMode } from "../use-display-mode";

type StatCard = {
  id: string;
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: "users" | "dollar" | "cart" | "eye" | "activity" | "chart";
};

type ActivityItem = {
  id: string;
  title: string;
  description: string;
  time: string;
  type?: "success" | "warning" | "info" | "error";
};

type ToolOutput = {
  title: string;
  subtitle?: string;
  period?: string;
  stats: StatCard[];
  activities?: ActivityItem[];
};

const iconMap = {
  users: Users,
  dollar: DollarSign,
  cart: ShoppingCart,
  eye: Eye,
  activity: Activity,
  chart: BarChart3,
};

const defaultProps: ToolOutput = {
  title: "Dashboard Overview",
  subtitle: "Your key metrics at a glance",
  period: "Last 30 days",
  stats: [
    {
      id: "revenue",
      label: "Total Revenue",
      value: "$45,231.89",
      change: 20.1,
      changeLabel: "from last month",
      icon: "dollar",
    },
    {
      id: "users",
      label: "Active Users",
      value: "2,350",
      change: 15.3,
      changeLabel: "from last month",
      icon: "users",
    },
    {
      id: "orders",
      label: "Orders",
      value: "1,247",
      change: -5.2,
      changeLabel: "from last month",
      icon: "cart",
    },
    {
      id: "views",
      label: "Page Views",
      value: "573,921",
      change: 12.5,
      changeLabel: "from last month",
      icon: "eye",
    },
  ],
  activities: [
    {
      id: "1",
      title: "New user registered",
      description: "john.doe@example.com signed up",
      time: "2 minutes ago",
      type: "success",
    },
    {
      id: "2",
      title: "Order completed",
      description: "Order #12345 has been fulfilled",
      time: "15 minutes ago",
      type: "info",
    },
    {
      id: "3",
      title: "Payment failed",
      description: "Transaction for $99.00 was declined",
      time: "1 hour ago",
      type: "error",
    },
    {
      id: "4",
      title: "Low stock alert",
      description: "Product SKU-789 is running low",
      time: "3 hours ago",
      type: "warning",
    },
  ],
};

function StatCardComponent({ stat, isDark }: { stat: StatCard; isDark: boolean }) {
  const Icon = stat.icon ? iconMap[stat.icon] : Activity;
  const isPositive = (stat.change ?? 0) >= 0;

  return (
    <div
      className={`p-4 rounded-xl border ${
        isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          {stat.label}
        </span>
        <div className={`p-2 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>
          <Icon className={`w-4 h-4 ${isDark ? "text-gray-400" : "text-gray-500"}`} />
        </div>
      </div>

      <div className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
        {stat.value}
      </div>

      {stat.change !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          {isPositive ? (
            <ArrowUpRight className="w-4 h-4 text-green-500" />
          ) : (
            <ArrowDownRight className="w-4 h-4 text-red-500" />
          )}
          <span className={isPositive ? "text-green-500" : "text-red-500"}>
            {isPositive ? "+" : ""}{stat.change}%
          </span>
          {stat.changeLabel && (
            <span className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              {stat.changeLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ActivityItemComponent({ item, isDark }: { item: ActivityItem; isDark: boolean }) {
  const typeColors = {
    success: "bg-green-500",
    warning: "bg-yellow-500",
    info: "bg-blue-500",
    error: "bg-red-500",
  };

  return (
    <div className="flex items-start gap-3 py-3">
      <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${typeColors[item.type || "info"]}`} />
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
          {item.title}
        </p>
        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          {item.description}
        </p>
      </div>
      <span className={`text-xs flex-shrink-0 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
        {item.time}
      </span>
    </div>
  );
}

export default function App() {
  const rawProps = useWidgetProps<Partial<ToolOutput>>(defaultProps);
  // Merge with defaults to ensure all required fields exist
  const props: ToolOutput = {
    ...defaultProps,
    ...rawProps,
    stats: rawProps?.stats ?? defaultProps.stats,
    activities: rawProps?.activities ?? defaultProps.activities,
  };
  const theme = useTheme() ?? "light";
  const displayMode = useDisplayMode() ?? "inline";
  const isDark = theme === "dark";

  const handleRequestFullscreen = () => {
    if (window.openai?.requestDisplayMode) {
      window.openai?.requestDisplayMode({ mode: "fullscreen" });
    } else if (window.webplus?.requestDisplayMode) {
      window.webplus?.requestDisplayMode({ mode: "fullscreen" });
    }
  };

  return (
    <div
      className={`w-full rounded-2xl border overflow-hidden ${
        isDark ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"
      }`}
    >
      {/* Header */}
      <div className={`p-4 border-b ${isDark ? "border-gray-700" : "border-gray-100"}`}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              {props.title}
            </h1>
            {props.subtitle && (
              <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                {props.subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {props.period && (
              <Badge variant="soft" color="secondary">
                {props.period}
              </Badge>
            )}
            {displayMode !== "fullscreen" && (
              <Button variant="outline" color="secondary" onClick={handleRequestFullscreen}>
                View Details
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {props.stats.map((stat) => (
            <StatCardComponent key={stat.id} stat={stat} isDark={isDark} />
          ))}
        </div>
      </div>

      {/* Activity Feed */}
      {props.activities && props.activities.length > 0 && (
        <div className={`p-4 border-t ${isDark ? "border-gray-700" : "border-gray-100"}`}>
          <h2 className={`text-lg font-semibold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
            Recent Activity
          </h2>
          <div className={`divide-y ${isDark ? "divide-gray-700" : "divide-gray-100"}`}>
            {props.activities.slice(0, displayMode === "fullscreen" ? undefined : 3).map((item) => (
              <ActivityItemComponent key={item.id} item={item} isDark={isDark} />
            ))}
          </div>
          {displayMode !== "fullscreen" && props.activities.length > 3 && (
            <button
              onClick={handleRequestFullscreen}
              className={`w-full mt-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isDark
                  ? "text-blue-400 hover:bg-gray-800"
                  : "text-blue-600 hover:bg-gray-50"
              }`}
            >
              View all {props.activities.length} activities
            </button>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className={`p-4 border-t flex flex-wrap gap-2 ${isDark ? "border-gray-700 bg-gray-800/50" : "border-gray-100 bg-gray-50"}`}>
        <Button variant="solid" color="primary" onClick={() => window.openai?.sendFollowUpMessage?.({ prompt: "Show me more details about revenue" })}>
          Revenue Details
        </Button>
        <Button variant="outline" color="secondary" onClick={() => window.openai?.sendFollowUpMessage?.({ prompt: "Show me user analytics" })}>
          User Analytics
        </Button>
        <Button variant="outline" color="secondary" onClick={() => window.openai?.sendFollowUpMessage?.({ prompt: "Generate a report" })}>
          Generate Report
        </Button>
      </div>
    </div>
  );
}
