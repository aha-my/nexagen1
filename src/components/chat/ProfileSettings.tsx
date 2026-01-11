import { useState, useEffect, useRef } from 'react';
import { User, Calendar, Save, Loader2, Camera, LogOut, Mail, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Profile {
  id: string;
  username: string;
  bio: string | null;
  gender: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
}

interface ProfileSettingsProps {
  onClose: () => void;
}

export default function ProfileSettings({ onClose }: ProfileSettingsProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, signOut } = useAuth();

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      toast.error('Failed to load profile');
    } else if (data) {
      setProfile(data);
      setUsername(data.username);
      setBio(data.bio || '');
      setGender(data.gender || '');
      setDateOfBirth(data.date_of_birth || '');
    }
    setLoading(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploading(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      toast.error('Failed to upload image');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('chat-media')
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: urlData.publicUrl })
      .eq('user_id', user.id);

    if (updateError) {
      toast.error('Failed to update avatar');
    } else {
      setProfile(prev => prev ? { ...prev, avatar_url: urlData.publicUrl } : null);
      toast.success('Avatar updated!');
    }

    setUploading(false);
  };

  const handleSave = async () => {
    if (!user || !username.trim()) return;

    if (username.length < 3) {
      toast.error('Username must be at least 3 characters');
      return;
    }

    setSaving(true);

    // Check if username is taken (if changed)
    if (username !== profile?.username) {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .neq('user_id', user.id)
        .maybeSingle();

      if (existingUser) {
        toast.error('Username already taken');
        setSaving(false);
        return;
      }
    }

    const genderValue = gender as "male" | "female" | "other" | "prefer_not_to_say" | null;
    
    const { error } = await supabase
      .from('profiles')
      .update({
        username: username.toLowerCase().replace(/[^a-z0-9_]/g, ''),
        bio: bio || null,
        gender: genderValue || null,
        date_of_birth: dateOfBirth || null,
      })
      .eq('user_id', user.id);

    if (error) {
      toast.error('Failed to save profile');
    } else {
      toast.success('Profile saved!');
      onClose();
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
      <div className="flex flex-col items-center gap-3 sm:gap-4">
        <div className="relative">
          <Avatar className="w-20 h-20 sm:w-24 sm:h-24">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="gradient-primary text-primary-foreground text-2xl sm:text-3xl">
              {username[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarUpload}
            accept="image/*"
            className="hidden"
          />
          <Button
            size="icon"
            className="absolute -bottom-2 -right-2 rounded-full w-8 h-8 gradient-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">Tap to change avatar</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username" className="text-sm">Username</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              className="pl-10 h-11 sm:h-10 text-base sm:text-sm"
              placeholder="Your username"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio" className="text-sm">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself..."
            rows={3}
            maxLength={160}
            className="text-base sm:text-sm resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{bio.length}/160</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gender" className="text-sm">Gender</Label>
          <Select value={gender} onValueChange={(val) => setGender(val)}>
            <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male" className="py-3 sm:py-2">Male</SelectItem>
              <SelectItem value="female" className="py-3 sm:py-2">Female</SelectItem>
              <SelectItem value="other" className="py-3 sm:py-2">Other</SelectItem>
              <SelectItem value="prefer_not_to_say" className="py-3 sm:py-2">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dob" className="text-sm">Date of Birth</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="pl-10 h-11 sm:h-10 text-base sm:text-sm"
            />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} className="w-full gradient-primary h-11 sm:h-10 text-base sm:text-sm" disabled={saving}>
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </>
        )}
      </Button>

      <Button 
        onClick={signOut} 
        variant="outline" 
        className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground h-11 sm:h-10 text-base sm:text-sm"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>

      <div className="pt-4 border-t border-border text-center space-y-2">
        <p className="text-xs text-muted-foreground font-medium">NexaLink</p>
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <span>Created by</span>
          <span className="font-medium">Tharun</span>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground">
          <a href="mailto:tarunarul0@gmail.com" className="flex items-center gap-1 hover:text-primary active:text-primary transition-colors py-1">
            <Mail className="w-3 h-3" />
            tarunarul0@gmail.com
          </a>
          <a href="https://nexa.co" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary active:text-primary transition-colors py-1">
            <Globe className="w-3 h-3" />
            nexa.co
          </a>
        </div>
      </div>
    </div>
  );
}
