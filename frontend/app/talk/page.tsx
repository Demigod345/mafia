// @ts-nocheck

"use client";

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle } from 'lucide-react';
import { Session, Chatbox } from '@talkjs/react';
import Talk from "talkjs";

function Chat() {
  const syncUser = useCallback(
    () =>
      new Talk.User({
        id: 'nina',
        name: 'Nina',
        email: 'nina@example.com',
        photoUrl: 'https://talkjs.com/new-web/avatar-7.jpg',
        welcomeMessage: 'Hi!',
      }),
    []
  );

  const syncConversation = useCallback((session) => {
    // JavaScript SDK code here
    const conversation = session.getOrCreateConversation('new_group_chat');

    const frank = new Talk.User({
      id: 'frank',
      name: 'Frank',
      email: 'frank@example.com',
      photoUrl: 'https://talkjs.com/new-web/avatar-8.jpg',
      welcomeMessage: 'Hey, how can I help?',
    });

    const juliana = new Talk.User({
      id: 'juliana',
      name: 'Juliana',
      email: 'juliana@example.com',
      photoUrl: 'https://talkjs.com/new-web/avatar-1.jpg',
      welcomeMessage: 'Hey, how can I help?',
    });

    conversation.setParticipant(session.me);
    conversation.setParticipant(frank);
    conversation.setParticipant(juliana);

    return conversation;
  }, []);

  return (
    <Session appId="tQrD36pK" syncUser={syncUser}>
      <Chatbox
        syncConversation={syncConversation}
        style={{ width: '100%', height: '500px' }}
      ></Chatbox>
    </Session>
  );
}
const ChatRoomEntry = () => {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    setIsJoining(true);

    // Here you would typically:
    // 1. Make an API call to create/join the room
    // 2. Navigate to the chat room page
    // For demo purposes, we'll just simulate a delay
    setTimeout(() => {
      alert(`Joining room ${roomId} as ${username}`);
      setIsJoining(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      
      <Chat />
      
    </div>
  );
};

export default ChatRoomEntry;