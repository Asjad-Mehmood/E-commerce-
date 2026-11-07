import type { Response } from "express";

type Cell = string | number | boolean | null | undefined | Date;

/**
 * One CSV field (RFC 4180). Values that a spreadsheet would run as a formula
 * (starting with = + - @, tab or CR) are prefixed with ' to stop CSV injection.
 */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Sends a CSV download (with a BOM so Excel reads UTF-8 correctly). */
export function sendCsv(res: Response, filename: string, headers: string[], rows: Cell[][]) {
  res
    .status(200)
    .type("text/csv; charset=utf-8")
    .set("Content-Disposition", `attachment; filename="${filename}"`)
    .send("﻿" + toCsv(headers, rows));
}

/** Money in minor units as a plain decimal for spreadsheets (e.g. 349900 → 3499.00). */
export const csvMoney = (minor: number) => (minor / 100).toFixed(2);
