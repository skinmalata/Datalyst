import "./globals.css";import Script from "next/script";import {AuthProvider} from "./auth-provider";
export const metadata={title:"Datalyst",description:"Decision intelligence"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><Script src="/runtime-config.js" strategy="beforeInteractive"/><AuthProvider>{children}</AuthProvider></body></html>}
