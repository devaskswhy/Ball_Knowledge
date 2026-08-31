"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, Wifi, WifiOff, ChevronDown } from "lucide-react"
import { Button } from "@/app/components/ui/button"
import { useState } from "react"
import Image from "next/image"
import { useWebSocket } from "@/app/contexts/WebSocketContext"
import { COMPETITION_ORDER, COMPETITIONS } from "@/app/lib/competitions"

export function Header() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [competitionsOpen, setCompetitionsOpen] = useState(false)
    const { wsConnected } = useWebSocket()
    const pathname = usePathname()

    const activeCode = pathname?.split("/")[1]?.toUpperCase()

    return (
        <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="mx-auto max-w-7xl px-4">
                <div className="flex h-16 items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2">
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
                    <nav className="hidden items-center gap-1 md:flex">
                        <div
                            className="relative"
                            onMouseEnter={() => setCompetitionsOpen(true)}
                            onMouseLeave={() => setCompetitionsOpen(false)}
                        >
                            <button className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:text-primary">
                                Competitions
                                <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                            {competitionsOpen && (
                                <div className="absolute right-0 top-full w-56 rounded-lg border border-border bg-card p-1 shadow-xl">
                                    {COMPETITION_ORDER.map((code) => {
                                        const meta = COMPETITIONS[code]
                                        const active = activeCode === code
                                        return (
                                            <Link
                                                key={code}
                                                href={`/${code}`}
                                                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-secondary ${active ? "text-primary font-semibold" : "text-foreground"}`}
                                            >
                                                <span>{meta.name}</span>
                                                <span className="text-xs text-muted-foreground">{meta.country}</span>
                                            </Link>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </nav>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        {/* Live Connection Status */}
                        <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-secondary/50">
                            {wsConnected ? (
                                <>
                                    <Wifi className="h-3 w-3 text-green-500" />
                                    <span className="text-[10px] text-green-500 font-medium">LIVE</span>
                                </>
                            ) : (
                                <>
                                    <WifiOff className="h-3 w-3 text-gray-500" />
                                    <span className="text-[10px] text-gray-500 font-medium">OFFLINE</span>
                                </>
                            )}
                        </div>

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
                        <nav className="flex flex-col gap-1">
                            <span className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Competitions
                            </span>
                            {COMPETITION_ORDER.map((code) => {
                                const meta = COMPETITIONS[code]
                                const active = activeCode === code
                                return (
                                    <Link
                                        key={code}
                                        href={`/${code}`}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${active ? "bg-secondary text-primary font-semibold" : "text-foreground"}`}
                                    >
                                        <span>{meta.name}</span>
                                        <span className="text-xs text-muted-foreground">{meta.country}</span>
                                    </Link>
                                )
                            })}
                        </nav>
                    </div>
                )}
            </div>
        </header>
    )
}
