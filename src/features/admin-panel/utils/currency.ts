const uzsFormatter = new Intl.NumberFormat("uz-UZ");

export function formatUzs(amount: number): string {
  return `${uzsFormatter.format(amount)} so'm`;
}
