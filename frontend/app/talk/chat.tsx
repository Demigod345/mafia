// @ts-nocheck

import { useCallback } from 'react';
import Talk from 'talkjs';
import { Session, Chatbox } from '@talkjs/react';

function Chat({name, gameId}) {
  const syncUser = useCallback(
    () =>
      new Talk.User({
        id: name.toLowerCase(),
        name: name,
        email: "",
        photoUrl: 'https://xsgames.co/randomusers/avatar.php?g=pixel',
        welcomeMessage: 'Hi! Welcome to Mafia!',
      }),
    []
  );

  const syncConversation = useCallback((session) => {
    // JavaScript SDK code here
    const conversation = session.getOrCreateConversation(gameId);

    conversation.setParticipant(session.me);

    return conversation;
  }, []);

  return (
    <Session appId="tQrD36pK" syncUser={syncUser}>
      <Chatbox
        syncConversation={syncConversation}
      ></Chatbox>
    </Session>
  );
}

export default Chat;
