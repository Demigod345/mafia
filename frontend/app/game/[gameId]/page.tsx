// @ts-nocheck

"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

export default function Page() {
  const params = useParams();
  const [gameId, setGameId] = useState(null);
  useEffect(() => {
    setGameId(params.gameId);
  }, [params.gameId]);
  return (
    <div>
      <h1>Game</h1>
      <p>Game ID: {gameId}</p>
    </div>
  );
}
