"use client";
import { useState } from "react";

export default function HoverCard({
  children,
  baseStyle,
  hoverStyle,
}: {
  children: React.ReactNode;
  baseStyle: React.CSSProperties;
  hoverStyle: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ ...baseStyle, ...(hovered ? hoverStyle : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </div>
  );
}
