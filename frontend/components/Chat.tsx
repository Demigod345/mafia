// @ts-nocheck

import { useCallback } from "react";
import { Chatbox, Session } from "@talkjs/react";
import Talk from "talkjs";

type ChatProps = {
  name: string;
  gameId: string;
};

export function Chat({ name, gameId }: ChatProps) {
  const syncUser = useCallback(
    () =>
      new Talk.User({
        id: name.toString().toLowerCase(),
        name: name.toString(),
        email: null,
        photoUrl: `https://robohash.org/${name}.png`,
        welcomeMessage: "Hi! Welcome to Mafia!",
      }),
    [name]
  );

  const syncConversation = useCallback(
    (session: Talk.Session) => {
      const conversation = session.getOrCreateConversation(gameId);
      conversation.setParticipant(session.me);
      return conversation;
    },
    [gameId]
  );

  return (
    <Session appId="tQrD36pK" syncUser={syncUser}>
      <Chatbox
        syncConversation={syncConversation}
        style={{ height: "500px" }}
      />
    </Session>
  );
}

