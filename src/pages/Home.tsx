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
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className={`w-full md:w-80 lg:w-96 border-r flex flex-col ${selectedFriend ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="p-4 border-b bg-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-display font-bold">ChatConnect</h1>
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Search className="w-5 h-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
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
              <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="gradient-primary text-primary-foreground">
                    {profile?.username?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="font-medium">@{profile?.username || 'Loading...'}</p>
                  <p className="text-sm text-muted-foreground">Tap to edit profile</p>
                </div>
                <Settings className="w-5 h-5 text-muted-foreground" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Profile Settings</SheetTitle>
              </SheetHeader>
              <ProfileSettings onClose={() => {
                setSettingsOpen(false);
                fetchProfile();
              }} />
              <div className="mt-4 p-4 border-t">
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={signOut}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
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
          <div className="flex-1 flex items-center justify-center bg-secondary/20">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center mx-auto shadow-glow">
                <MessageCircle className="w-10 h-10 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-display font-semibold">Welcome to ChatConnect</h2>
                <p className="text-muted-foreground">Select a conversation or find new friends</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
