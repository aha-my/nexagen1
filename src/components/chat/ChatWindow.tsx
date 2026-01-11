import { useState, useEffect, useRef } from 'react';
import { Send, Image, Video, MoreVertical, ArrowLeft, Loader2, Trash2, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Message {
  id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  sender_id: string;
  created_at: string;
}

interface Friend {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  conversationId?: string;
}

interface ChatWindowProps {
  friend: Friend;
  onBack: () => void;
  onFriendRemoved: () => void;
}

export default function ChatWindow({ friend, onBack, onFriendRemoved }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(friend.conversationId || null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchOrCreateConversation = async () => {
    if (!user) return;

    // Try to find existing conversation
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${friend.user_id}),and(participant1_id.eq.${friend.user_id},participant2_id.eq.${user.id})`)
      .maybeSingle();

    if (existing) {
      setConversationId(existing.id);
      return existing.id;
    }

    // Create new conversation
    const { data: newConversation, error } = await supabase
      .from('conversations')
      .insert({
        participant1_id: user.id,
        participant2_id: friend.user_id,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to start conversation');
      return null;
    }

    setConversationId(newConversation.id);
    return newConversation.id;
  };

  const fetchMessages = async (convId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const convId = await fetchOrCreateConversation();
      if (convId) {
        fetchMessages(convId);
      } else {
        setLoading(false);
      }
    };
    init();
  }, [friend.user_id]);

  useEffect(() => {
    if (!conversationId) return;

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || sending) return;

    setSending(true);
    let convId = conversationId;

    if (!convId) {
      convId = await fetchOrCreateConversation();
      if (!convId) {
        setSending(false);
        return;
      }
    }

    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: convId,
        sender_id: user.id,
        content: newMessage.trim(),
      });

    if (error) {
      toast.error('Failed to send message');
    } else {
      setNewMessage('');
    }
    setSending(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      toast.error('Only images and videos are allowed');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      return;
    }

    setUploading(true);

    let convId = conversationId;
    if (!convId) {
      convId = await fetchOrCreateConversation();
      if (!convId) {
        setUploading(false);
        return;
      }
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(fileName, file);

    if (uploadError) {
      toast.error('Failed to upload file');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('chat-media')
      .getPublicUrl(fileName);

    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: convId,
        sender_id: user.id,
        media_url: urlData.publicUrl,
        media_type: isImage ? 'image' : 'video',
      });

    if (messageError) {
      toast.error('Failed to send media');
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteFriend = async () => {
    if (!user) return;

    try {
      await supabase
        .from('friendships')
        .delete()
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friend.user_id}),and(requester_id.eq.${friend.user_id},addressee_id.eq.${user.id})`);

      toast.success(`Removed ${friend.username} from friends`);
      onFriendRemoved();
    } catch (error) {
      toast.error('Failed to remove friend');
    }
    setShowDeleteDialog(false);
  };

  const handleBlockUser = async () => {
    if (!user) return;

    try {
      // Update friendship to blocked
      await supabase
        .from('friendships')
        .update({ status: 'blocked' })
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friend.user_id}),and(requester_id.eq.${friend.user_id},addressee_id.eq.${user.id})`);

      toast.success(`Blocked ${friend.username}`);
      onFriendRemoved();
    } catch (error) {
      toast.error('Failed to block user');
    }
    setShowBlockDialog(false);
  };

  return (
    <div className="flex flex-col h-[100dvh] md:h-full">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-b bg-card safe-area-top">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden h-9 w-9">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Avatar className="w-9 h-9 sm:w-10 sm:h-10">
          <AvatarImage src={friend.avatar_url || undefined} />
          <AvatarFallback className="gradient-primary text-primary-foreground text-sm sm:text-base">
            {friend.username[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm sm:text-base truncate">@{friend.username}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem 
              className="text-destructive py-3"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove Friend
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-destructive py-3"
              onClick={() => setShowBlockDialog(true)}
            >
              <Ban className="w-4 h-4 mr-2" />
              Block User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm sm:text-base">No messages yet. Say hello! 👋</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = message.sender_id === user?.id;
            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-2.5 sm:p-3 ${
                    isOwn
                      ? 'gradient-primary text-primary-foreground rounded-br-md'
                      : 'bg-secondary rounded-bl-md'
                  }`}
                >
                  {message.media_url && (
                    <div className="mb-2">
                      {message.media_type === 'image' ? (
                        <img
                          src={message.media_url}
                          alt="Shared image"
                          className="rounded-lg max-w-full max-h-64 sm:max-h-80 object-contain"
                        />
                      ) : (
                        <video
                          src={message.media_url}
                          controls
                          className="rounded-lg max-w-full max-h-64 sm:max-h-80"
                        />
                      )}
                    </div>
                  )}
                  {message.content && <p className="text-sm sm:text-base break-words">{message.content}</p>}
                  <p className={`text-[10px] sm:text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {format(new Date(message.created_at), 'HH:mm')}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-3 sm:p-4 border-t bg-card safe-area-bottom">
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*,video/*"
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="h-10 w-10 flex-shrink-0"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Image className="w-5 h-5" />
            )}
          </Button>
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 h-11 sm:h-10 text-base sm:text-sm"
          />
          <Button type="submit" size="icon" className="gradient-primary h-10 w-10 flex-shrink-0" disabled={sending || !newMessage.trim()}>
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </form>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Remove Friend</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to remove @{friend.username} from your friends? This will also delete your conversation history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="h-11 sm:h-10">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFriend} className="bg-destructive text-destructive-foreground h-11 sm:h-10">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block Dialog */}
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Block User</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to block @{friend.username}? They won't be able to send you messages or friend requests.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="h-11 sm:h-10">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlockUser} className="bg-destructive text-destructive-foreground h-11 sm:h-10">
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
