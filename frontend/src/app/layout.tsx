import "./globals.css";import Script from "next/script";import {AuthProvider} from "./auth-provider";
export const metadata={title:"Datalyst",description:"Decision intelligence",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg",apple:"/favicon.svg"}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><Script src="/runtime-config.js" strategy="beforeInteractive"/><AuthProvider>{children}</AuthProvider></body></html>}
