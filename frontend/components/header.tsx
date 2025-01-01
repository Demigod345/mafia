// @ts-nocheck

import React from 'react'
import { Button } from "@/components/ui/button"
import { Shield } from 'lucide-react'

interface HeaderProps {
  address: string
}

export function shortenAddress(address: string): string {
  if (address.length <= 10) {
    return address; // Return as-is if the address is already short
  }
  return `${address.toString().slice(0, 6)}...${address.toString().slice(-4)}`;
}

export function Header({ address }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 py-4">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Shield className="h-8 w-8 text-black" />
          <span className="font-bold text-xl text-black">MafiaChain</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">Connected:</span>
          <Button variant="outline" className="font-mono text-sm">
            {shortenAddress(address)}
          </Button>
        </div>
      </div>
    </header>
  )
}

