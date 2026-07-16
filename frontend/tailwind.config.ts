import type { Config } from "tailwindcss";
const config: Config = { content:["./src/**/*.{js,ts,jsx,tsx}"], theme:{extend:{colors:{background:"#09111f",surface:"#111d31",border:"#283952",primary:"#7982ff",text:{primary:"#ffffff",secondary:"#e1e9f4",muted:"#c2cfe0"}}}}, plugins:[] };
export default config;
