import { useState, useEffect } from 'react';
import { Search, Settings, LogOut, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import NotificationBell from '@/components/chat/NotificationBell';
import UserSearch from '@/components/chat/UserSearch';
import ChatList from '@/components/chat/ChatList';
import ChatWindow from '@/components/chat/ChatWindow';
import ProfileSettings from '@/components/chat/ProfileSettings';

interface Friend {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  conversationId?: string;
}

interface Profile {
  username: string;
  avatar_url: string | null;
}

export default function Home() {
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user, signOut } = useAuth();

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setProfile(data);
    }
  };

  const handleSelectChat = (friend: Friend) => {
    setSelectedFriend(friend);
  };

  const handleFriendRemoved = () => {
    setSelectedFriend(null);
  };

  return (
    <div className="flex h-[100dvh] bg-background">
      {/* Sidebar */}
      <div className={`w-full md:w-80 lg:w-96 border-r flex flex-col ${selectedFriend ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="p-3 sm:p-4 border-b bg-card safe-area-top">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl gradient-primary flex items-center justify-center">
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
              </div>
              <h1 className="text-lg sm:text-xl font-display font-bold">NexaLink</h1>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1">
              <NotificationBell />
              <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
                    <Search className="w-5 h-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto rounded-xl">
                  <DialogHeader>
                    <DialogTitle>Find Friends</DialogTitle>
                  </DialogHeader>
                  <UserSearch onClose={() => setSearchOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Profile Quick Access */}
          <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
            <SheetTrigger asChild>
              <button className="w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-secondary/50 hover:bg-secondary active:scale-[0.98] transition-all">
                <Avatar className="w-9 h-9 sm:w-10 sm:h-10">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="gradient-primary text-primary-foreground text-sm sm:text-base">
                    {profile?.username?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-medium text-sm sm:text-base truncate">@{profile?.username || 'Loading...'}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Tap to edit profile</p>
                </div>
                <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-full sm:max-w-md p-0">
              <SheetHeader className="p-4 sm:p-6 border-b">
                <SheetTitle>Profile Settings</SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto h-[calc(100dvh-80px)]">
                <ProfileSettings onClose={() => {
                  setSettingsOpen(false);
                  fetchProfile();
                }} />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto safe-area-bottom">
          <ChatList
            onSelectChat={handleSelectChat}
            selectedFriendId={selectedFriend?.user_id}
          />
        </div>
      </div>

      {/* Chat Window */}
      <div className={`flex-1 ${selectedFriend ? 'flex' : 'hidden md:flex'} flex-col`}>
        {selectedFriend ? (
          <ChatWindow
            friend={selectedFriend}
            onBack={() => setSelectedFriend(null)}
            onFriendRemoved={handleFriendRemoved}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-secondary/20 p-4">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl gradient-primary flex items-center justify-center mx-auto shadow-glow">
                <MessageCircle className="w-8 h-8 sm:w-10 sm:h-10 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-display font-semibold">Welcome to NexaLink</h2>
                <p className="text-sm sm:text-base text-muted-foreground">Select a conversation or find new friends</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
