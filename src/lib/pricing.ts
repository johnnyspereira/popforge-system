export type PricingInput = { filamentSpoolPrice:number; filamentSpoolGrams:number; filamentUsedGrams:number; packagingPurchasePrice:number; packagingUnits:number; packagingUsed:number; printHours:number; energyCostPerHour:number; laborMinutes:number; laborCostPerHour:number; otherCosts:number; failureRatePercent:number; marginPercent:number; vatPercent:number };
export type PricingBreakdown = { filamentCost:number; packagingCost:number; energyCost:number; laborCost:number; otherCosts:number; directCost:number; failureReserve:number; totalCost:number; netPrice:number; vatAmount:number; finalPrice:number; profit:number };
const safe=(value:number)=>Number.isFinite(value)&&value>0?value:0;
const divide=(total:number,units:number)=>safe(units)?safe(total)/safe(units):0;
export function calculatePrice(input:PricingInput):PricingBreakdown {
  const filamentCost=divide(input.filamentSpoolPrice,input.filamentSpoolGrams)*safe(input.filamentUsedGrams);
  const packagingCost=divide(input.packagingPurchasePrice,input.packagingUnits)*safe(input.packagingUsed);
  const energyCost=safe(input.printHours)*safe(input.energyCostPerHour);
  const laborCost=(safe(input.laborMinutes)/60)*safe(input.laborCostPerHour);
  const otherCosts=safe(input.otherCosts);
  const directCost=filamentCost+packagingCost+energyCost+laborCost+otherCosts;
  const failureReserve=directCost*(safe(input.failureRatePercent)/100);
  const totalCost=directCost+failureReserve;
  const margin=Math.min(safe(input.marginPercent),95)/100;
  const netPrice=margin<1?totalCost/(1-margin):totalCost;
  const vatAmount=netPrice*(safe(input.vatPercent)/100);
  return {filamentCost,packagingCost,energyCost,laborCost,otherCosts,directCost,failureReserve,totalCost,netPrice,vatAmount,finalPrice:netPrice+vatAmount,profit:netPrice-totalCost};
}
