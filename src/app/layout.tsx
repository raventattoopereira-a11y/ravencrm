import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM Estudio | Monteclaro",
  description: "CRM interno — cuadre diario, inventario, servicios y calendario.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
