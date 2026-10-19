import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export function calculate(a: number, b: number, operation: 'add' | 'subtract' | 'multiply' | 'divide') {
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('Angka harus finite.');
  if (operation === 'divide' && b === 0) throw new Error('Tidak dapat membagi dengan nol.');
  const value = { add: () => a + b, subtract: () => a - b, multiply: () => a * b, divide: () => a / b }[operation]();
  if (!Number.isFinite(value)) throw new Error('Hasil di luar rentang angka.');
  return { value };
}

export const calculateTool = createTool({
  id: 'calculate',
  description: 'Hitung penjumlahan, pengurangan, perkalian, atau pembagian dua angka.',
  inputSchema: z.object({ a: z.number().finite(), b: z.number().finite(), operation: z.enum(['add', 'subtract', 'multiply', 'divide']) }),
  outputSchema: z.object({ value: z.number().finite() }),
  execute: async ({ a, b, operation }) => calculate(a, b, operation),
});

export function currentTime(timeZone: string) {
  return { timeZone, time: new Intl.DateTimeFormat('id-ID', { timeZone, dateStyle: 'full', timeStyle: 'long' }).format(new Date()) };
}

export const currentTimeTool = createTool({
  id: 'current_time',
  description: 'Lihat tanggal dan waktu saat ini di zona waktu IANA, misalnya Asia/Jakarta.',
  inputSchema: z.object({ timeZone: z.string().max(100).default('Asia/Jakarta') }),
  outputSchema: z.object({ timeZone: z.string(), time: z.string() }),
  execute: async ({ timeZone }) => currentTime(timeZone),
});

export const agentTools = { calculate: calculateTool, current_time: currentTimeTool };
