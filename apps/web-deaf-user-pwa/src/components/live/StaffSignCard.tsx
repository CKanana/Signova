import { SignovaAvatarPlayer } from "../avatar/SignovaAvatarPlayer";
import type { Message } from "../../../../../shared/types/session";

interface StaffSignCardProps {
  message: Message;
  dataSaver: boolean;
  reduceMotion: boolean;
  onRetry: (messageId: string) => void;
}

export function StaffSignCard({
  message,
  dataSaver,
  reduceMotion,
  onRetry,
}: StaffSignCardProps) {
  return (
    <SignovaAvatarPlayer
      message={message}
      dataSaver={dataSaver}
      reduceMotion={reduceMotion}
      onRetry={onRetry}
    />
  );
}
