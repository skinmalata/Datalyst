import { chartForResult } from "@/lib/result-visualization";
test("uses a line chart for forecasts", () => { expect(chartForResult({ forecast:[12,15] })).toEqual({ chartType:"line", values:[{label:"Forecast 1",value:12},{label:"Forecast 2",value:15}] }); });
test("uses a comparison chart where both values exist", () => { expect(chartForResult({ value:12, comparison:{baseline:10} })).toEqual({ chartType:"bar", values:[{label:"Current",value:12},{label:"Baseline",value:10}] }); });
