import Link from "next/link"
import { Twitter, Instagram, Youtube } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <span className="text-lg font-bold text-primary-foreground">BK</span>
              </div>
              <span className="text-xl font-bold">Ball Knowledge</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Premium football analytics and live match insights for the modern fan.
            </p>
            <div className="flex gap-4">
              <Link href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                <Twitter className="h-5 w-5" />
                <span className="sr-only">Twitter</span>
              </Link>
              <Link href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                <Instagram className="h-5 w-5" />
                <span className="sr-only">Instagram</span>
              </Link>
              <Link href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                <Youtube className="h-5 w-5" />
                <span className="sr-only">YouTube</span>
              </Link>
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="mb-4 font-semibold">Competitions</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="#" className="text-muted-foreground hover:text-foreground">Premier League</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-foreground">La Liga</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-foreground">Champions League</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-foreground">Serie A</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold">Analytics</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="#" className="text-muted-foreground hover:text-foreground">Player Stats</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-foreground">Team Comparison</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-foreground">xG Analysis</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-foreground">Heat Maps</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold">Company</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="#" className="text-muted-foreground hover:text-foreground">About Us</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-foreground">Careers</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-foreground">Press</Link></li>
              <li><Link href="#" className="text-muted-foreground hover:text-foreground">Contact</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Ball Knowledge. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm">
            <Link href="#" className="text-muted-foreground hover:text-foreground">Privacy</Link>
            <Link href="#" className="text-muted-foreground hover:text-foreground">Terms</Link>
            <Link href="#" className="text-muted-foreground hover:text-foreground">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
