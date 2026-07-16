import "./globals.css";import Script from "next/script";
export const metadata={title:"Datalyst",description:"Decision intelligence"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><Script src="/runtime-config.js" strategy="beforeInteractive"/>{children}</body></html>}
