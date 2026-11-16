import { DIMENSIONS } from "./calculator-config.js";

function distributeLinePrices(items, totalPriceCents) {
  const prices = items.map((item) => Math.floor(item.rawPriceCents));
  let centsToDistribute =
    totalPriceCents - prices.reduce((sum, value) => sum + value, 0);
  const remainderOrder = items
    .map((item, index) => ({
      index,
      fraction: item.rawPriceCents - Math.floor(item.rawPriceCents),
    }))
    .sort((left, right) => right.fraction - left.fraction);

  for (
    let index = 0;
    index < remainderOrder.length && centsToDistribute > 0;
    index++
  ) {
    prices[remainderOrder[index].index] += 1;
    centsToDistribute -= 1;
  }
  return prices;
}

export function calculatePriceBreakdown(config, items) {
  const dimension = DIMENSIONS[config.dimension];
  const inputUnit = dimension?.units[config.inputUnit];
  const rateUnit = dimension?.units[config.rateUnit];
  if (!inputUnit || !rateUnit) {
    throw new Error("The calculator has an unsupported measurement unit.");
  }

  const pricedItems = items.map((item) => {
    const measure =
      config.dimension === "per_item"
        ? item.quantity
        : item.measure * item.quantity;
    const measureBase = measure * inputUnit.factor;
    return {
      measureBase,
      rawPriceCents: (measureBase / rateUnit.factor) * config.ratePerUnit * 100,
    };
  });
  const totalMeasureBase = pricedItems.reduce(
    (total, item) => total + item.measureBase,
    0,
  );
  const totalPriceCents = Math.round(
    (totalMeasureBase / rateUnit.factor) * config.ratePerUnit * 100,
  );

  return {
    totalMeasureBase,
    totalPriceCents,
    linePriceCents: distributeLinePrices(pricedItems, totalPriceCents),
    inputUnit,
    rateUnit,
  };
}
