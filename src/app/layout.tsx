import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title:"Ngọc Agent Studio",description:"Personal AI workspace for SEO, marketing and social media",robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body>{children}</body></html>}
