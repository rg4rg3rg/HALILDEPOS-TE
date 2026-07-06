import "./globals.css";

export const metadata = {
  title: {
    default: "Kişisel Bulut",
    template: "%s | Kişisel Bulut"
  },
  description: "Supabase Storage destekli kişisel dosya paneli",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
