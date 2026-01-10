import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

interface Friend {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  lastMessage?: string;
  lastMessageTime?: string;
  conversationId?: string;
}

interface ChatListProps {
  onSelectChat: (friend: Friend) => void;
  selectedFriendId?: string;
}

export default function ChatList({ onSelectChat, selectedFriendId }: ChatListProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchFriends = async () => {
    if (!user) return;
    
    // Get accepted friendships
    const { data: friendships } = await supabase
      .from('friendships')
      .select('*')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (!friendships) {
      setLoading(false);
      return;
    }

    // Get friend user IDs
    const friendUserIds = friendships.map(f => 
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    );

    if (friendUserIds.length === 0) {
      setFriends([]);
      setLoading(false);
      return;
    }

    // Get friend profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', friendUserIds);

    if (profiles) {
      // Get conversations and last messages
      const friendsWithConversations = await Promise.all(
        profiles.map(async (profile) => {
          const { data: conversation } = await supabase
            .from('conversations')
            .select('id')
            .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${profile.user_id}),and(participant1_id.eq.${profile.user_id},participant2_id.eq.${user.id})`)
            .maybeSingle();

          let lastMessage = undefined;
          let lastMessageTime = undefined;

          if (conversation) {
            const { data: message } = await supabase
              .from('messages')
              .select('content, created_at')
              .eq('conversation_id', conversation.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (message) {
              lastMessage = message.content || '📷 Media';
              lastMessageTime = message.created_at;
            }
          }

          return {
            ...profile,
            lastMessage,
            lastMessageTime,
            conversationId: conversation?.id,
          };
        })
      );

      // Sort by last message time
      friendsWithConversations.sort((a, b) => {
        if (!a.lastMessageTime && !b.lastMessageTime) return 0;
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      });

      setFriends(friendsWithConversations);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchFriends();

    // Subscribe to friendship changes
    const friendshipChannel = supabase
      .channel('friendships-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
        },
        () => {
          fetchFriends();
        }
      )
      .subscribe();

    // Subscribe to message changes
    const messageChannel = supabase
      .channel('messages-list')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchFriends();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(friendshipChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-3 w-32 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>No friends yet</p>
        <p className="text-sm mt-1">Search for users to add friends!</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {friends.map((friend) => (
        <button
          key={friend.id}
          onClick={() => onSelectChat(friend)}
          className={`w-full flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors text-left ${
            selectedFriendId === friend.user_id ? 'bg-secondary' : ''
          }`}
        >
          <Avatar className="w-12 h-12">
            <AvatarImage src={friend.avatar_url || undefined} />
            <AvatarFallback className="gradient-primary text-primary-foreground text-lg">
              {friend.username[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="font-medium">@{friend.username}</p>
              {friend.lastMessageTime && (
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(friend.lastMessageTime), { addSuffix: true })}
                </span>
              )}
            </div>
            {friend.lastMessage && (
              <p className="text-sm text-muted-foreground truncate">{friend.lastMessage}</p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
