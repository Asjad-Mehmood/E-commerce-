"use client";

import { Button, cn } from "@hoodie/ui";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { formatMoney } from "@/admin/lib/format";

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  sales: number; // minor units
  orders: number;
}

const PLOT_H = 220;
const AXIS_H = 28; // x-axis label band (part of the container height)
const LEFT = 56; // y-axis label band
const TOP = 20; // room for the peak label
const BAR_MAX = 24;
const GAP = 2;

const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/** Rupee axis ticks: in full under 10,000, compact above (10K, 1.2M). */
function tickLabel(minor: number, max: number) {
  const rupees = minor / 100;
  if (max / 100 < 10_000) return `Rs ${rupees.toLocaleString("en-PK")}`;
  return `Rs ${new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(rupees)}`;
}

/** Round the top of the axis up to 1, 2, 2.5 or 5 × a power of ten. */
function niceMax(value: number): number {
  if (value <= 0) return 100_000; // Rs 1,000 so an empty chart still has an axis
  const exp = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) if (value <= step * exp) return step * exp;
  return 10 * exp;
}

/** Column path with a 4px rounded top and a square base. */
function columnPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Net sales per day as thin columns: one series (so no legend; the card title
 * names it), hover/keyboard tooltip, the peak day labelled, and a table twin.
 */
export function SalesChart({ data, dim }: { data: DailyPoint[]; dim?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [table]);

  const max = useMemo(() => niceMax(Math.max(0, ...data.map((d) => d.sales))), [data]);
  const peak = useMemo(
    () =>
      data.reduce(
        (best, d, i) => (d.sales > (data[best]?.sales ?? 0) ? i : best),
        data.findIndex((d) => d.sales > 0),
      ),
    [data],
  );

  const plotW = width - LEFT - 8;
  const band = plotW / Math.max(1, data.length);
  const barW = Math.max(1, Math.min(BAR_MAX, band - GAP));
  const y = (v: number) => TOP + PLOT_H - (v / max) * PLOT_H;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(plotW / 64)));

  const onKey = (e: KeyboardEvent) => {
    if (!data.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? 1 : -1;
      setActive((a) => Math.min(data.length - 1, Math.max(0, (a ?? data.length - 1) + delta)));
    } else if (e.key === "Escape") setActive(null);
  };

  const point = active !== null ? data[active] : undefined;
  const tipLeft = active !== null ? LEFT + active * band + band / 2 : 0;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setTable((t) => !t)} aria-pressed={table}>
          {table ? "Show chart" : "Show as table"}
        </Button>
      </div>

      {table ? (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-muted text-left text-xs uppercase">
              <tr>
                <th className="py-1.5 font-semibold">Day</th>
                <th className="py-1.5 text-right font-semibold">Orders</th>
                <th className="py-1.5 text-right font-semibold">Net sales</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...data].reverse().map((d) => (
                <tr key={d.date} className="border-line border-t">
                  <td className="py-1.5">{dayLabel(d.date)}</td>
                  <td className="py-1.5 text-right">{d.orders}</td>
                  <td className="py-1.5 text-right">{formatMoney(d.sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={wrap}
          className={cn("relative transition-opacity", dim && "opacity-50")}
          style={{ height: TOP + PLOT_H + AXIS_H }}
        >
          <svg
            width={width}
            height={TOP + PLOT_H + AXIS_H}
            role="img"
            aria-label={`Net sales per day, ${data.length} days. Use the arrow keys to read each day, or show the chart as a table.`}
            tabIndex={0}
            onKeyDown={onKey}
            onBlur={() => setActive(null)}
            onPointerLeave={() => setActive(null)}
            className="focus-visible:ring-brand-500 block rounded-md outline-none focus-visible:ring-2"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={LEFT}
                  x2={width - 8}
                  y1={y(t)}
                  y2={y(t)}
                  className="stroke-line"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={LEFT - 8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted text-[11px] tabular-nums"
                >
                  {tickLabel(t, max)}
                </text>
              </g>
            ))}

            {data.map((d, i) => {
              const x = LEFT + i * band + (band - barW) / 2;
              const h = (d.sales / max) * PLOT_H;
              return (
                <g key={d.date}>
                  {h > 0 && (
                    <path
                      d={columnPath(x, y(d.sales), barW, h)}
                      className={cn(
                        "fill-brand-600 transition-opacity",
                        active !== null && active !== i && "opacity-40",
                      )}
                    />
                  )}
                  {/* Hit target: the whole band, taller than the mark. */}
                  <rect
                    x={LEFT + i * band}
                    y={TOP}
                    width={band}
                    height={PLOT_H}
                    fill="transparent"
                    onPointerEnter={() => setActive(i)}
                    onPointerMove={() => setActive(i)}
                  />
                  {i % labelEvery === 0 && (
                    <text
                      x={LEFT + i * band + band / 2}
                      y={TOP + PLOT_H + 18}
                      textAnchor="middle"
                      className="fill-muted text-[11px]"
                    >
                      {dayLabel(d.date)}
                    </text>
                  )}
                </g>
              );
            })}

            {peak >= 0 && data[peak] && active === null && (
              <text
                x={Math.min(width - 40, Math.max(LEFT + 30, LEFT + peak * band + band / 2))}
                y={y(data[peak].sales) - 6}
                textAnchor="middle"
                className="fill-ink text-[11px] font-semibold"
              >
                {formatMoney(data[peak].sales)}
              </text>
            )}
          </svg>

          {point && (
            <div
              role="status"
              className="border-line bg-canvas pointer-events-none absolute top-0 z-10 w-40 -translate-x-1/2 rounded-lg border px-3 py-2 text-sm shadow-md"
              style={{ left: Math.min(width - 84, Math.max(84, tipLeft)) }}
            >
              <p className="font-semibold">{formatMoney(point.sales)}</p>
              <p className="text-muted text-xs">
                {point.orders} order{point.orders === 1 ? "" : "s"} · {dayLabel(point.date)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
