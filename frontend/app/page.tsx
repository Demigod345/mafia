// @ts-nocheck

'use client'

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Zap, Users, ChevronRight, Sun, Moon, Network } from 'lucide-react';
import { motion } from "framer-motion";
import { RpcProvider, Contract, CallData, WalletAccount } from "starknet";
import { connect } from "get-starknet";
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function MafiaGameLanding() {
  const router = useRouter();
  const [connection, setConnection] = useState(null);
  const [address, setAddress] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check user's preference from localStorage or system preference
    const darkModePreference = localStorage.getItem('darkMode') || window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(darkModePreference === 'true');
  }, []);

  useEffect(() => {
    // Update body class and localStorage when dark mode changes
    document.body.classList.toggle('dark', isDarkMode);
    localStorage.setItem('darkMode', isDarkMode);
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleConnectWallet = async() => {
    try {
      const selectedWalletSWO = await connect({
        modalTheme: isDarkMode ? "dark" : "light",
      });
      const wallet = new WalletAccount(
        { nodeUrl: process.env.NEXT_PUBLIC_STARKNET_RPC_URL },
        selectedWalletSWO
      );

      console.log(wallet);

      if (wallet) {
        setConnection(wallet);
        setAddress(wallet.address);
      }

      router.push('/game');
    } catch (error) {
      console.error("Error connecting wallet:", error);
    }
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
      <header className={`container mx-auto px-4 py-6 flex justify-between items-center border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
        <div className="flex items-center space-x-2">
          <Shield className="h-8 w-8" />
          <span className="font-bold text-xl">Cali Mafia</span>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            onClick={toggleDarkMode}
            variant="ghost"
            size="icon"
            className={isDarkMode ? 'text-white' : 'text-black'}
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button
            onClick={handleConnectWallet}
            className={`${isDarkMode ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'} rounded-full px-6`}
          >
            Connect Wallet
          </Button>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto"
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              Secure, Private, and
              <br />
              <span className={`border-b-4 ${isDarkMode ? 'border-white' : 'border-black'}`}>Verifiable</span> Gaming
            </h1>
            <p className={`text-xl ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-12 max-w-2xl mx-auto`}>
              Experience the future of decentralized gaming with
              blockchain-verified user interactions and anonymous gameplay
              powered by Calimero Network and Starknet.
            </p>
            <Button
              onClick={handleConnectWallet}
              className={`${isDarkMode ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'} rounded-full px-8 py-6 text-lg`}
            >
              Start Playing Now
            </Button>
          </motion.div>
        </section>

        {/* Features Section */}
        <section className={isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}>
          <div className="container mx-auto px-4 py-24">
            <h2 className="text-3xl font-bold text-center mb-16">
              Key Features
            </h2>
            <div className="grid md:grid-cols-4 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={`${isDarkMode ? 'bg-gray-700' : 'bg-white'} p-8 rounded-lg shadow-sm`}
              >
                <Lock className="h-12 w-12 mb-6" />
                <h3 className="text-xl font-bold mb-4">Private Context</h3>
                <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                  Secure P2P private discussions and hidden identities powered
                  by Calimero Network.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className={`${isDarkMode ? 'bg-gray-700' : 'bg-white'} p-8 rounded-lg shadow-sm`}
              >
                <Zap className="h-12 w-12 mb-6" />
                <h3 className="text-xl font-bold mb-4">Scalable Gaming</h3>
                <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                  High-performance gameplay with Starknet's Layer 2 scaling
                  solution.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className={`${isDarkMode ? 'bg-gray-700' : 'bg-white'} p-8 rounded-lg shadow-sm`}
              >
                <Users className="h-12 w-12 mb-6" />
                <h3 className="text-xl font-bold mb-4">Fair Gameplay</h3>
                <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                  Verifiable and transparent game mechanics with blockchain
                  technology.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className={`${isDarkMode ? 'bg-gray-700' : 'bg-white'} p-8 rounded-lg shadow-sm`}
              >
                <Network className="h-12 w-12 mb-6" />
                <h3 className="text-xl font-bold mb-4">Decentralized Infrastructure</h3>
                <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                  Built on cutting-edge blockchain technology for true decentralization.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* System Architecture Section */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-16">
              System Architecture
            </h2>
            <div className="max-w-4xl mx-auto">
              <Image
                src="https://cdn.dorahacks.io/static/files/194320198d21bf6fedd3aa74977bff1a.png"
                alt="Cali Mafia System Architecture"
                width={1000}
                height={600}
                className="rounded-lg shadow-lg"
              />
              <p className={`mt-8 text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Cali Mafia leverages Calimero Network for private computations and Starknet for scalable, 
                verifiable gameplay, ensuring a secure and efficient gaming experience.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className={isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}>
          <div className="container mx-auto px-4 py-24">
            <h2 className="text-3xl font-bold text-center mb-16">
              How It Works
            </h2>
            <div className="max-w-3xl mx-auto">
              <div className="space-y-12">
                {[
                  {
                    step: "01",
                    title: "Connect Wallet",
                    description:
                      "Link your wallet to join the decentralized gaming network.",
                  },
                  {
                    step: "02",
                    title: "Join Private Room",
                    description:
                      "Enter a secure game room with encrypted communication via Calimero.",
                  },
                  {
                    step: "03",
                    title: "Play Securely",
                    description:
                      "Enjoy anonymous and fair gameplay with other players on Starknet.",
                  },
                  {
                    step: "04",
                    title: "Verify Outcomes",
                    description:
                      "All game results are verified and recorded on-chain for transparency.",
                  },
                ].map((item, index) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="flex items-start space-x-8"
                  >
                    <div className={`text-4xl font-bold ${isDarkMode ? 'text-gray-700' : 'text-gray-200'}`}>
                      {item.step}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2 flex items-center">
                        {item.title}
                        <ChevronRight className="h-5 w-5 ml-2" />
                      </h3>
                      <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>{item.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className={isDarkMode ? 'bg-gray-900' : 'bg-black'}>
          <div className="container mx-auto px-4 py-24 text-center text-white">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-4xl font-bold mb-6">
                Ready to Experience the Future of Gaming?
              </h2>
              <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
                Join the revolution of secure, private, and verifiable gaming
                powered by Calimero and Starknet blockchain technology.
              </p>
              <Button
                onClick={handleConnectWallet}
                className={`${isDarkMode ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-100 text-black hover:bg-gray-200'} rounded-full px-8 py-6 text-lg`}
              >
                Connect Wallet to Start
              </Button>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'} py-8`}>
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>© {new Date().getFullYear()} Cali Mafia. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

