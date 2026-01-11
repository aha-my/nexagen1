import { useState } from 'react';
import { Search, UserPlus, Loader2, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Profile {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
}

interface UserSearchProps {
  onClose?: () => void;
}

export default function UserSearch({ onClose }: UserSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  const searchUsers = async (searchQuery: string) => {
    if (!searchQuery.trim() || !user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .rpc('search_profiles_by_username', {
        search_query: searchQuery,
        exclude_user_id: user.id
      });

    if (error) {
      toast.error('Failed to search users');
    } else {
      setResults(data || []);
    }
    setLoading(false);
  };

  const sendFriendRequest = async (profile: Profile) => {
    if (!user) return;
    
    setSendingRequest(profile.user_id);
    
    try {
      // Check if friendship already exists
      const { data: existing } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${profile.user_id}),and(requester_id.eq.${profile.user_id},addressee_id.eq.${user.id})`)
        .maybeSingle();

      if (existing) {
        toast.info('Friend request already exists');
        setSendingRequest(null);
        return;
      }

      // Create friendship request
      const { data: friendship, error: friendshipError } = await supabase
        .from('friendships')
        .insert({
          requester_id: user.id,
          addressee_id: profile.user_id,
          status: 'pending',
        })
        .select()
        .single();

      if (friendshipError) throw friendshipError;

      // Create notification
      await supabase
        .from('notifications')
        .insert({
          user_id: profile.user_id,
          type: 'friend_request',
          from_user_id: user.id,
          friendship_id: friendship.id,
        });

      setSentRequests(prev => new Set(prev).add(profile.user_id));
      toast.success(`Friend request sent to ${profile.username}`);
    } catch (error) {
      toast.error('Failed to send friend request');
    }
    
    setSendingRequest(null);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by username..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.length >= 2) {
              searchUsers(e.target.value);
            } else {
              setResults([]);
            }
          }}
          className="pl-10"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          {results.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="gradient-primary text-primary-foreground">
                    {profile.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">@{profile.username}</p>
                  {profile.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-1">{profile.bio}</p>
                  )}
                </div>
              </div>
              
              <Button
                size="sm"
                variant={sentRequests.has(profile.user_id) ? "outline" : "default"}
                className={sentRequests.has(profile.user_id) ? "" : "gradient-primary"}
                disabled={sendingRequest === profile.user_id || sentRequests.has(profile.user_id)}
                onClick={() => sendFriendRequest(profile)}
              >
                {sendingRequest === profile.user_id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : sentRequests.has(profile.user_id) ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Sent
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-1" />
                    Add
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {!loading && query.length >= 2 && results.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No users found matching "{query}"
        </div>
      )}

      {!loading && query.length < 2 && (
        <div className="text-center py-8 text-muted-foreground">
          Type at least 2 characters to search
        </div>
      )}
    </div>
  );
}
