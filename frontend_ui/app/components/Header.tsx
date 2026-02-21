"use client"

import Link from "next/link"
import { Search, Bell, User, Menu, X, Trophy } from "lucide-react"
import { Button } from "@/app/components/ui/button"
import { useState } from "react"
import Image from "next/image"

interface HeaderProps {
    league: string
    setLeague: (league: string) => void
}

const LEAGUES = [
    { code: "PL", name: "Premier League" },
    { code: "LL", name: "La Liga" },
    { code: "SA", name: "Serie A" },
    { code: "L1", name: "Ligue 1" },
    { code: "BL", name: "Bundesliga" },
    { code: "WC", name: "World Cup" },
]

export function Header({ league, setLeague }: HeaderProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    return (
        <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="mx-auto max-w-7xl px-4">
                <div className="flex h-16 items-center justify-between">
                    {/* Logo */}
                    <Link href="#" className="flex items-center gap-2">
                        <Image
                            src="/logo.jpg"
                            alt="Ball Knowledge"
                            width={36}
                            height={36}
                            className="rounded-lg"
                        />
                        <span className="text-xl font-bold tracking-tight">Ball Knowledge</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden items-center gap-6 md:flex">
                        <Link href="#predictor" className="text-sm font-medium text-foreground transition-colors hover:text-primary">
                            Predictor
                        </Link>

                        {/* League Selector */}
                        <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-muted-foreground" />
                            <select
                                value={league}
                                onChange={(e) => setLeague(e.target.value)}
                                className="bg-transparent text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1"
                                suppressHydrationWarning
                            >
                                {LEAGUES.map((l) => (
                                    <option key={l.code} value={l.code} className="bg-background">
                                        {l.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </nav>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="hidden sm:flex">
                            <Search className="h-5 w-5" />
                            <span className="sr-only">Search</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="hidden sm:flex">
                            <Bell className="h-5 w-5" />
                            <span className="sr-only">Notifications</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="hidden sm:flex">
                            <User className="h-5 w-5" />
                            <span className="sr-only">Profile</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </Button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="border-t border-border py-4 md:hidden">
                        <nav className="flex flex-col gap-4">
                            <Link href="#predictor" className="text-sm font-medium text-foreground">
                                Predictor
                            </Link>

                            <div className="flex flex-col gap-2">
                                <span className="text-xs text-muted-foreground">League</span>
                                <select
                                    value={league}
                                    onChange={(e) => setLeague(e.target.value)}
                                    className="bg-secondary text-sm font-medium rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                                    suppressHydrationWarning
                                >
                                    {LEAGUES.map((l) => (
                                        <option key={l.code} value={l.code}>
                                            {l.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </nav>
                    </div>
                )}
            </div>
        </header>
    )
}
