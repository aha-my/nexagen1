import { useState, useEffect } from 'react';
import { Bell, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Notification {
  id: string;
  type: string;
  from_user_id: string;
  friendship_id: string;
  is_read: boolean;
  created_at: string;
  from_profile?: {
    username: string;
    avatar_url: string | null;
  };
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchNotifications = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (data) {
      // Fetch profile info for each notification
      const notificationsWithProfiles = await Promise.all(
        data.map(async (notification) => {
          if (notification.from_user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('user_id', notification.from_user_id)
              .single();
            return { ...notification, from_profile: profile };
          }
          return notification;
        })
      );
      setNotifications(notificationsWithProfiles);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleFriendRequest = async (notification: Notification, accept: boolean) => {
    setProcessingId(notification.id);
    
    try {
      if (accept) {
        // Accept friend request
        await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('id', notification.friendship_id);
        
        toast.success(`You are now friends with ${notification.from_profile?.username}`);
      } else {
        // Reject friend request
        await supabase
          .from('friendships')
          .delete()
          .eq('id', notification.friendship_id);
        
        toast.info('Friend request declined');
      }

      // Mark notification as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);

      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    } catch (error) {
      toast.error('Failed to process request');
    }
    
    setProcessingId(null);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {notifications.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full gradient-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
              {notifications.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
        </div>
        
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No new notifications
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div key={notification.id} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={notification.from_profile?.avatar_url || undefined} />
                      <AvatarFallback className="gradient-primary text-primary-foreground">
                        {notification.from_profile?.username?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">@{notification.from_profile?.username}</span>
                        {notification.type === 'friend_request' && ' sent you a friend request'}
                      </p>
                    </div>
                  </div>
                  
                  {notification.type === 'friend_request' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gradient-primary"
                        onClick={() => handleFriendRequest(notification, true)}
                        disabled={processingId === notification.id}
                      >
                        {processingId === notification.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Accept
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleFriendRequest(notification, false)}
                        disabled={processingId === notification.id}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
