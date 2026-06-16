import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus, Edit2, Trash2, Loader2, XCircle, AlertTriangle,
  Eye, EyeOff, Search, MapPin, Image, Calendar,
  Coins, Target, Check, ChevronRight, Tag,
  Upload, ChevronLeft, Clock
} from 'lucide-react';
import api from '../lib/axios';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Mission {
  _id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  requiredPlaceIds: string[];
  reward: {
    type: 'points' | 'souvenir' | 'checkin_frame';
    pointsAmount?: number;
    souvenirId?: string;
    frameId?: string;
  };
  isActive: boolean;
  order: number;
  startsAt?: string;
  endsAt?: string;
}

interface Place {
  placeId: string;
  name: string;
  address?: string;
  city?: string;
  category?: string;
  images?: string[];
  rating?: number;
  addedCount?: number;
  isCheckinEnabled?: boolean;
}

interface Frame {
  _id: string;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  isActive: boolean;
  unlockType?: string;
}

const EMPTY_FORM = {
  title: '',
  description: '',
  imageUrl: '',
  requiredPlaceIds: [] as string[],
  rewardType: 'points' as 'points' | 'souvenir' | 'checkin_frame',
  pointsAmount: 10,
  souvenirId: '',
  frameId: '',
  startsAt: '',
  endsAt: '',
  order: 1,
  isActive: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toLocalDatetimeString = (dateString?: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const YYYY = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const DD = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
};

const toISODateString = (localDateTime?: string) => {
  if (!localDateTime) return undefined;
  const date = new Date(localDateTime);
  if (isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

const normalizePlace = (p: any): Place => {
  return {
    placeId: p.placeId || p.id || '',
    name: typeof p.name === 'string' ? p.name : (p.name?.text || p.displayName?.text || ''),
    address: p.address || p.formattedAddress || '',
    city: p.city || '',
    category: p.category || (p.types && p.types[0]) || '',
    images: p.images || (p.photos && p.photos.map((ph: any) => typeof ph === 'string' ? ph : (ph?.name || ''))) || [],
    rating: p.rating || 0,
    addedCount: p.addedCount || 0,
    isCheckinEnabled: p.isCheckinEnabled !== false,
  };
};

const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

const getGridDays = (viewDate: Date) => {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  
  const totalDays = getDaysInMonth(year, month);
  const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday=0, Monday=1
  const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const prevMonthTotalDays = getDaysInMonth(year, month - 1);

  const days: { day: number; isCurrentMonth: boolean; date: Date }[] = [];

  // Trailing days of previous month
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = prevMonthTotalDays - i;
    days.push({
      day: d,
      isCurrentMonth: false,
      date: new Date(year, month - 1, d)
    });
  }

  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    days.push({
      day: i,
      isCurrentMonth: true,
      date: new Date(year, month, i)
    });
  }

  // Leading days of next month to fill grid
  const remainingCells = 42 - days.length;
  for (let i = 1; i <= remainingCells; i++) {
    days.push({
      day: i,
      isCurrentMonth: false,
      date: new Date(year, month + 1, i)
    });
  }

  return days;
};

function CustomDateTimePicker({
  value,
  onChange,
  label
}: {
  value: string;
  onChange: (val: string) => void;
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse values
  const dateObj = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  const [viewDate, setViewDate] = useState(() => dateObj || new Date());
  const [hours, setHours] = useState(() => dateObj ? dateObj.getHours() : 12);
  const [minutes, setMinutes] = useState(() => dateObj ? dateObj.getMinutes() : 0);

  // Synchronize viewDate if value changes externally
  useEffect(() => {
    if (dateObj) {
      setViewDate(dateObj);
      setHours(dateObj.getHours());
      setMinutes(dateObj.getMinutes());
    }
  }, [dateObj]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectDay = (date: Date) => {
    const newDateStr = formatDateTime(date, hours, minutes);
    onChange(newDateStr);
  };

  const handleChangeTime = (h: number, m: number) => {
    setHours(h);
    setMinutes(m);
    const targetDate = dateObj || new Date();
    const newDateStr = formatDateTime(targetDate, h, m);
    onChange(newDateStr);
  };

  const handlePrevMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  const handleToday = () => {
    const today = new Date();
    onChange(formatDateTime(today, hours, minutes));
    setViewDate(today);
  };

  const formatDateTime = (date: Date, h: number, m: number) => {
    const YYYY = date.getFullYear();
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const DD = String(date.getDate()).padStart(2, '0');
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    return `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
  };

  const gridDays = useMemo(() => getGridDays(viewDate), [viewDate]);

  // Display label formatting
  const displayValue = useMemo(() => {
    if (!dateObj) return 'Chọn ngày và giờ';
    const YYYY = dateObj.getFullYear();
    const MM = String(dateObj.getMonth() + 1).padStart(2, '0');
    const DD = String(dateObj.getDate()).padStart(2, '0');
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return `${DD}/${MM}/${YYYY} ${hh}:${mm}`;
  }, [dateObj, hours, minutes]);

  const monthNames = [
    'Tháng Một', 'Tháng Hai', 'Tháng Ba', 'Tháng Tư', 'Tháng Năm', 'Tháng Sáu',
    'Tháng Bảy', 'Tháng Tám', 'Tháng Chín', 'Tháng Mười', 'Tháng Mười Một', 'Tháng Mười Hai'
  ];

  return (
    <div className="space-y-1.5 relative w-full" ref={containerRef}>
      <label className="text-xs font-semibold text-gray-700">{label}</label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-transparent hover:border-gray-200 cursor-pointer rounded-xl text-sm outline-none transition-all w-full select-none"
      >
        <span className={dateObj ? 'text-gray-900 font-medium' : 'text-gray-400'}>
          {displayValue}
        </span>
        <Calendar className="w-4 h-4 text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 sm:bottom-auto sm:top-full sm:mt-2 bg-white border border-gray-100 rounded-3xl shadow-2xl z-50 p-4 w-72 animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between mb-3.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <span className="font-bold text-gray-900 text-sm">
              {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
              <span key={d} className="text-[10px] font-bold text-gray-400 uppercase">
                {d}
              </span>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1 text-center mb-3">
            {gridDays.map((gd, idx) => {
              const isSelected = dateObj && 
                gd.date.getDate() === dateObj.getDate() && 
                gd.date.getMonth() === dateObj.getMonth() && 
                gd.date.getFullYear() === dateObj.getFullYear();
              
              const isToday = () => {
                const today = new Date();
                return gd.date.getDate() === today.getDate() &&
                  gd.date.getMonth() === today.getMonth() &&
                  gd.date.getFullYear() === today.getFullYear();
              };

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectDay(gd.date)}
                  className={`h-8 w-8 text-xs font-semibold rounded-full flex items-center justify-center transition-all ${
                    !gd.isCurrentMonth ? 'text-gray-300' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                  } ${isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : ''} ${
                    isToday() && !isSelected ? 'border border-blue-500 text-blue-600' : ''
                  }`}
                >
                  {gd.day}
                </button>
              );
            })}
          </div>

          {/* Time Selector */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-3 mb-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-gray-400" /> Giờ
            </span>
            <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-xl border border-gray-100">
              <input
                type="number"
                min={0}
                max={23}
                value={hours}
                onChange={e => handleChangeTime(Math.min(23, Math.max(0, Number(e.target.value) || 0)), minutes)}
                className="w-7 text-center font-bold text-sm bg-transparent outline-none text-gray-700"
              />
              <span className="text-gray-400 font-bold">:</span>
              <input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={e => handleChangeTime(hours, Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
                className="w-7 text-center font-bold text-sm bg-transparent outline-none text-gray-700"
              />
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex gap-2 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 py-1.5 hover:bg-red-50 text-red-500 font-bold rounded-xl text-[11px] transition-colors"
            >
              Xóa
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="flex-1 py-1.5 hover:bg-blue-50 text-blue-600 font-bold rounded-xl text-[11px] transition-colors"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-[11px] transition-all"
            >
              Xong
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Missions() {
  const [activeTab, setActiveTab] = useState<'missions' | 'places'>('missions');

  // --- States: Missions ---
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(true);
  const [errorMissions, setErrorMissions] = useState('');

  // --- States: Places ---
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const [placeSearchInput, setPlaceSearchInput] = useState('');
  const [placeCache, setPlaceCache] = useState<Record<string, Place>>({});

  // --- States: Frames ---
  const [frames, setFrames] = useState<Frame[]>([]);
  const [loadingFrames, setLoadingFrames] = useState(false);

  // --- States: Form Modal ---
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // --- States: Image Upload ---
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- States: Delete Modal ---
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingMission, setDeletingMission] = useState<Mission | null>(null);

  // --- States: Search inside Form for Places ---
  const [formPlaceSearch, setFormPlaceSearch] = useState('');
  const [formPlaceResults, setFormPlaceResults] = useState<Place[]>([]);
  const [searchingFormPlaces, setSearchingFormPlaces] = useState(false);
  const [showPlaceDropdown, setShowPlaceDropdown] = useState(false);
  const placeDropdownRef = useRef<HTMLDivElement>(null);

  // --- Effect: Load initial data ---
  useEffect(() => {
    fetchMissions();
    fetchInitialPlaces();
    fetchFrames();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (placeDropdownRef.current && !placeDropdownRef.current.contains(event.target as Node)) {
        setShowPlaceDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- API Calls: Missions ---
  const fetchMissions = async () => {
    try {
      setLoadingMissions(true);
      setErrorMissions('');
      const res = await api.get('/missions/admin');
      if (res.data?.success) {
        setMissions(res.data.missions || []);
      } else {
        setErrorMissions('Không tải được danh sách nhiệm vụ');
      }
    } catch (err: any) {
      setErrorMissions(err.response?.data?.message || 'Lỗi khi tải danh sách nhiệm vụ');
    } finally {
      setLoadingMissions(false);
    }
  };

  const fetchFrames = async () => {
    try {
      setLoadingFrames(true);
      const res = await api.get('/frames/admin');
      if (res.data?.success) {
        setFrames(res.data.frames || []);
      }
    } catch (err) {
      console.error('Error fetching frames:', err);
    } finally {
      setLoadingFrames(false);
    }
  };

  // --- API Calls: Places ---
  const fetchInitialPlaces = async () => {
    try {
      setLoadingPlaces(true);
      setPlaceError('');
      // Fetch top added places to populate initial cache and show in list
      const res = await api.get('/places/gettopplaces?limit=50&minAddedCount=0');
      if (res.data?.success) {
        const fetchedPlaces: Place[] = (res.data.places || []).map(normalizePlace);
        setPlaces(fetchedPlaces);
        
        // Cache these places by ID for name resolutions
        const cache: Record<string, Place> = {};
        fetchedPlaces.forEach(p => {
          cache[p.placeId] = p;
        });
        setPlaceCache(prev => ({ ...prev, ...cache }));
      }
    } catch (err: any) {
      setPlaceError('Lỗi khi tải danh sách địa điểm');
    } finally {
      setLoadingPlaces(false);
    }
  };

  // Search places in Places tab
  const handlePlacesSearch = async (val: string) => {
    setPlaceSearchInput(val);
    if (!val.trim()) {
      fetchInitialPlaces();
      return;
    }
    try {
      setLoadingPlaces(true);
      const res = await api.get(`/places/search?q=${encodeURIComponent(val)}`);
      if (res.data?.success) {
        const searched: Place[] = (res.data.places || []).map(normalizePlace);
        setPlaces(searched);

        // Update cache
        const cache: Record<string, Place> = {};
        searched.forEach(p => {
          cache[p.placeId] = p;
        });
        setPlaceCache(prev => ({ ...prev, ...cache }));
      }
    } catch (err) {
      console.error('Error searching places:', err);
    } finally {
      setLoadingPlaces(false);
    }
  };

  // Search places in Mission Form dropdown
  const handleFormPlaceSearch = async (val: string) => {
    setFormPlaceSearch(val);
    if (!val.trim()) {
      setFormPlaceResults([]);
      return;
    }
    try {
      setSearchingFormPlaces(true);
      const res = await api.get(`/places/search?q=${encodeURIComponent(val)}`);
      if (res.data?.success) {
        const results: Place[] = (res.data.places || []).map(normalizePlace);
        setFormPlaceResults(results);

        // Also add to global cache
        const cache: Record<string, Place> = {};
        results.forEach(p => {
          cache[p.placeId] = p;
        });
        setPlaceCache(prev => ({ ...prev, ...cache }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingFormPlaces(false);
    }
  };

  // Toggle isCheckinEnabled for a Place
  const handleTogglePlaceCheckin = async (place: Place) => {
    const originalStatus = place.isCheckinEnabled !== false; // default true
    const newStatus = !originalStatus;

    // Optimistic UI update
    setPlaces(prev => prev.map(p => p.placeId === place.placeId ? { ...p, isCheckinEnabled: newStatus } : p));
    setPlaceCache(prev => {
      if (prev[place.placeId]) {
        return {
          ...prev,
          [place.placeId]: { ...prev[place.placeId], isCheckinEnabled: newStatus }
        };
      }
      return prev;
    });

    try {
      // Try PATCH first
      try {
        await api.patch(`/places/${place.placeId}/toggle-checkin`, { isCheckinEnabled: newStatus });
      } catch (err: any) {
        // Fallback to PUT /places/:id if PATCH is 404 or fails
        if (err.response?.status === 404) {
          await api.put(`/places/${place.placeId}`, { isCheckinEnabled: newStatus });
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      // Revert UI if error
      alert(err.response?.data?.message || 'Không thể cập nhật trạng thái check-in');
      setPlaces(prev => prev.map(p => p.placeId === place.placeId ? { ...p, isCheckinEnabled: originalStatus } : p));
      setPlaceCache(prev => {
        if (prev[place.placeId]) {
          return {
            ...prev,
            [place.placeId]: { ...prev[place.placeId], isCheckinEnabled: originalStatus }
          };
        }
        return prev;
      });
    }
  };

  // --- Modal Forms Handlers ---
  const openAddForm = () => {
    setEditingMission(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setFormPlaceSearch('');
    setFormPlaceResults([]);
    setSelectedImageFile(null);
    setImagePreviewUrl('');
    setIsFormOpen(true);
  };

  const openEditForm = (mission: Mission) => {
    setEditingMission(mission);
    setForm({
      title: mission.title,
      description: mission.description || '',
      imageUrl: mission.imageUrl || '',
      requiredPlaceIds: mission.requiredPlaceIds || [],
      rewardType: mission.reward?.type || 'points',
      pointsAmount: mission.reward?.pointsAmount || 10,
      souvenirId: mission.reward?.souvenirId || '',
      frameId: mission.reward?.frameId || '',
      startsAt: toLocalDatetimeString(mission.startsAt),
      endsAt: toLocalDatetimeString(mission.endsAt),
      order: mission.order || 1,
      isActive: mission.isActive !== false,
    });
    setFormError('');
    setFormPlaceSearch('');
    setFormPlaceResults([]);
    setSelectedImageFile(null);
    setImagePreviewUrl(mission.imageUrl || '');
    setIsFormOpen(true);
  };

  // Frontend validation
  const validateForm = () => {
    if (!form.title.trim()) {
      return 'Vui lòng nhập tiêu đề nhiệm vụ.';
    }
    if (form.requiredPlaceIds.length === 0) {
      return 'Vui lòng chọn ít nhất một địa điểm check-in.';
    }
    if (form.rewardType === 'points' && (!form.pointsAmount || form.pointsAmount <= 0)) {
      return 'Số điểm thưởng phải lớn hơn 0.';
    }
    if (form.rewardType === 'souvenir' && !form.souvenirId.trim()) {
      return 'Vui lòng nhập ID Quà lưu niệm.';
    }
    if (form.rewardType === 'checkin_frame' && !form.frameId) {
      return 'Vui lòng chọn một Khung hình phần thưởng.';
    }
    if (form.startsAt && form.endsAt && new Date(form.startsAt) >= new Date(form.endsAt)) {
      return 'Ngày bắt đầu phải nhỏ hơn ngày kết thúc.';
    }
    return null;
  };

  const handleSubmitMission = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    let finalImageUrl = form.imageUrl;

    try {
      // 1. Upload image to Cloudinary first if a file is selected
      if (selectedImageFile) {
        const formData = new FormData();
        formData.append('image', selectedImageFile);
        const uploadRes = await api.post('/system/upload-image', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        if (uploadRes.data?.success && uploadRes.data?.url) {
          finalImageUrl = uploadRes.data.url;
        } else {
          throw new Error(uploadRes.data?.message || 'Không thể upload ảnh, vui lòng thử lại.');
        }
      }

      // 2. Prepare payload
      const rewardPayload: any = { type: form.rewardType };
      if (form.rewardType === 'points') {
        rewardPayload.pointsAmount = Number(form.pointsAmount);
      } else if (form.rewardType === 'souvenir') {
        rewardPayload.souvenirId = form.souvenirId;
      } else if (form.rewardType === 'checkin_frame') {
        rewardPayload.frameId = form.frameId;
      }

      const payload = {
        title: form.title,
        description: form.description || undefined,
        imageUrl: finalImageUrl || undefined,
        requiredPlaceIds: form.requiredPlaceIds,
        reward: rewardPayload,
        isActive: form.isActive,
        order: Number(form.order) || 1,
        startsAt: toISODateString(form.startsAt),
        endsAt: toISODateString(form.endsAt)
      };

      // 3. Submit payload
      if (editingMission) {
        const res = await api.put(`/missions/${editingMission._id}`, payload);
        if (res.data?.success) {
          setMissions(prev => prev.map(m => m._id === editingMission._id ? res.data.mission : m));
          setIsFormOpen(false);
        }
      } else {
        const res = await api.post('/missions', payload);
        if (res.data?.success) {
          setMissions(prev => [res.data.mission, ...prev]);
          setIsFormOpen(false);
        }
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle mission isActive status
  const handleToggleMission = async (mission: Mission) => {
    try {
      const res = await api.patch(`/missions/${mission._id}/toggle`);
      if (res.data?.success) {
        setMissions(prev => prev.map(m => m._id === mission._id ? { ...m, isActive: !m.isActive } : m));
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể cập nhật trạng thái nhiệm vụ');
    }
  };

  // Delete mission
  const handleDeleteMission = async () => {
    if (!deletingMission) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/missions/${deletingMission._id}`);
      if (res.data?.success) {
        setMissions(prev => prev.filter(m => m._id !== deletingMission._id));
        setIsDeleteOpen(false);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Xóa nhiệm vụ thất bại');
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Place Selection Helpers in Form ---
  const handleAddPlaceId = (placeId: string, placeData?: Place) => {
    if (!form.requiredPlaceIds.includes(placeId)) {
      setForm(f => ({ ...f, requiredPlaceIds: [...f.requiredPlaceIds, placeId] }));
      if (placeData) {
        setPlaceCache(prev => ({ ...prev, [placeId]: placeData }));
      }
    }
    setFormPlaceSearch('');
    setFormPlaceResults([]);
    setShowPlaceDropdown(false);
  };

  const handleRemovePlaceId = (placeId: string) => {
    setForm(f => ({ ...f, requiredPlaceIds: f.requiredPlaceIds.filter(id => id !== placeId) }));
  };

  // Filter frames to only show those that can be used for missions
  const missionFrames = useMemo(() => {
    return frames.filter(f => f.isActive && f.unlockType !== 'free');
  }, [frames]);

  // Statistics calculation
  const stats = useMemo(() => {
    return {
      total: missions.length,
      active: missions.filter(m => m.isActive).length,
      points: missions.filter(m => m.reward.type === 'points').length,
      frames: missions.filter(m => m.reward.type === 'checkin_frame').length,
    };
  }, [missions]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Quản lý Nhiệm vụ Check-in</h1>
          <p className="text-gray-500 text-sm mt-1">Cài đặt các nhiệm vụ, quản lý phần thưởng check-in và kích hoạt địa điểm</p>
        </div>
        {activeTab === 'missions' && (
          <button
            onClick={openAddForm}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            Thêm nhiệm vụ mới
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setActiveTab('missions')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'missions'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Nhiệm vụ Check-in
        </button>
        <button
          onClick={() => setActiveTab('places')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'places'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Kích hoạt Địa điểm
        </button>
      </div>

      {activeTab === 'missions' ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Tổng nhiệm vụ', value: stats.total, color: 'from-blue-500 to-indigo-600' },
              { label: 'Đang chạy', value: stats.active, color: 'from-emerald-500 to-teal-600' },
              { label: 'Thưởng Điểm', value: stats.points, color: 'from-amber-500 to-orange-600' },
              { label: 'Thưởng Khung', value: stats.frames, color: 'from-purple-500 to-pink-600' },
            ].map(s => (
              <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl p-4 text-white shadow-md`}>
                <p className="text-white/80 text-xs font-medium">{s.label}</p>
                <p className="text-3xl font-bold mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Missions List */}
          <div className="bg-white rounded-2xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
              <span className="font-bold text-gray-800 text-sm">Danh sách Nhiệm vụ</span>
              <span className="text-xs text-gray-400 font-medium">Tìm thấy {missions.length} nhiệm vụ</span>
            </div>

            <div className="p-6">
              {loadingMissions ? (
                <div className="flex items-center justify-center py-20 text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin mr-3 text-blue-600" />
                  <span className="text-sm">Đang tải nhiệm vụ...</span>
                </div>
              ) : errorMissions ? (
                <div className="py-20 text-center text-red-500">{errorMissions}</div>
              ) : missions.length === 0 ? (
                <div className="py-20 text-center text-gray-400 text-sm">Chưa có nhiệm vụ nào được cấu hình.</div>
              ) : (
                <div className="space-y-4">
                  {missions
                    .sort((a, b) => a.order - b.order)
                    .map(mission => {
                      const rewardType = mission.reward?.type;
                      return (
                        <div
                          key={mission._id}
                          className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 rounded-2xl border border-gray-100 hover:border-blue-100 transition-all duration-200 gap-4 bg-white"
                        >
                          {/* Image & Title */}
                          <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 shrink-0 overflow-hidden flex items-center justify-center relative">
                              {mission.imageUrl ? (
                                <img src={mission.imageUrl} alt={mission.title} className="w-full h-full object-cover" />
                              ) : (
                                <Target className="w-6 h-6 text-gray-400" />
                              )}
                              <span className="absolute bottom-0 right-0 bg-gray-900/60 text-[9px] text-white px-1 font-semibold rounded-tl">
                                #{mission.order}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-gray-900 text-base">{mission.title}</h3>
                                {mission.isActive ? (
                                  <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    Hoạt động
                                  </span>
                                ) : (
                                  <span className="bg-gray-100 text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    Tắt
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-500 text-xs mt-1 line-clamp-2">{mission.description || 'Không có mô tả'}</p>

                              {/* Dates */}
                              {(mission.startsAt || mission.endsAt) && (
                                <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-2">
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>
                                    {mission.startsAt ? new Date(mission.startsAt).toLocaleDateString('vi-VN') : 'Mở'} 
                                    {' - '} 
                                    {mission.endsAt ? new Date(mission.endsAt).toLocaleDateString('vi-VN') : 'Vô thời hạn'}
                                  </span>
                                </div>
                              )}

                              {/* Places tags */}
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {mission.requiredPlaceIds?.map(placeId => {
                                  const name = placeCache[placeId]?.name || placeId;
                                  return (
                                    <span key={placeId} className="inline-flex items-center gap-1 bg-slate-50 border border-gray-100 text-gray-600 text-[10px] font-medium px-2 py-0.5 rounded-lg">
                                      <MapPin className="w-2.5 h-2.5 text-blue-400" />
                                      {name}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Reward & Actions */}
                          <div className="flex items-center md:flex-col items-end gap-3 self-stretch justify-between md:justify-center shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-gray-50">
                            {/* Reward badge */}
                            <div className="text-right">
                              <span className="text-[10px] text-gray-400 font-semibold block uppercase tracking-wider mb-1">
                                Phần thưởng
                              </span>
                              {rewardType === 'points' && (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-100">
                                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                                  +{mission.reward.pointsAmount} Xu
                                </span>
                              )}
                              {rewardType === 'souvenir' && (
                                <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-rose-100">
                                  <Tag className="w-3.5 h-3.5 text-rose-500" />
                                  Kỷ niệm: {mission.reward.souvenirId}
                                </span>
                              )}
                              {rewardType === 'checkin_frame' && (
                                <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-purple-100">
                                  <Image className="w-3.5 h-3.5 text-purple-500" />
                                  Khung hình
                                </span>
                              )}
                            </div>

                            {/* Actions buttons */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleToggleMission(mission)}
                                className={`p-2 rounded-xl border transition-all ${
                                  mission.isActive
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
                                    : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'
                                }`}
                                title={mission.isActive ? 'Tắt nhiệm vụ' : 'Bật nhiệm vụ'}
                              >
                                {mission.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => openEditForm(mission)}
                                className="p-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl hover:bg-blue-100 transition-all"
                                title="Sửa"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setDeletingMission(mission); setIsDeleteOpen(true); }}
                                className="p-2 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-100 transition-all"
                                title="Xóa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Places Management Tab */
        <div className="bg-white rounded-2xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden">
          {/* Search Bar */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4 bg-gray-50/30">
            <div className="relative max-w-sm w-full group">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder="Tìm địa điểm check-in (vd: Vũng Tàu, Đà Lạt)..."
                value={placeSearchInput}
                onChange={e => handlePlacesSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
              />
            </div>
            <span className="text-xs text-gray-400 font-semibold whitespace-nowrap">
              Tìm thấy {places.length} địa điểm
            </span>
          </div>

          {/* Places Grid */}
          <div className="p-6">
            {loadingPlaces ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
                <p className="text-sm">Đang tải danh sách địa điểm...</p>
              </div>
            ) : placeError ? (
              <div className="py-20 text-center text-red-500 font-medium">{placeError}</div>
            ) : places.length === 0 ? (
              <div className="py-20 text-center text-gray-400 text-sm">Không tìm thấy địa điểm nào.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {places.map(place => {
                  const checkinAllowed = place.isCheckinEnabled !== false;
                  return (
                    <div
                      key={place.placeId}
                      className={`group rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col p-4 ${
                        checkinAllowed
                          ? 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-md'
                          : 'bg-slate-50/50 border-slate-200'
                      }`}
                    >
                      {/* Name & City */}
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                          {place.images && place.images.length > 0 ? (
                            <img src={place.images[0]} alt={place.name} className="w-full h-full object-cover" />
                          ) : (
                            <MapPin className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-1 group-hover:text-blue-600 transition-colors">
                            {place.name}
                          </h3>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{place.city || 'Chưa rõ thành phố'}</p>
                          <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed" title={place.address}>
                            {place.address}
                          </p>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-gray-100/70 my-3.5" />

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-[10px] text-gray-400 font-medium">
                          Lượt lưu: <strong className="text-gray-700">{place.addedCount || 0}</strong>
                        </span>

                        <button
                          onClick={() => handleTogglePlaceCheckin(place)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            checkinAllowed
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-red-50 text-red-600 hover:bg-red-100'
                          }`}
                        >
                          {checkinAllowed ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              Cho phép check-in
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              Khóa check-in
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====== Form Modal (Add / Edit) ====== */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl z-20">
              <h2 className="text-lg font-bold text-gray-900">
                {editingMission ? 'Chỉnh sửa nhiệm vụ' : 'Thêm nhiệm vụ mới'}
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitMission} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                  {formError}
                </div>
              )}

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Tên nhiệm vụ *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="VD: Khám phá thành phố biển Vũng Tàu"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-xl text-sm outline-none transition-all"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Mô tả nhiệm vụ</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="VD: Đi qua các điểm danh thắng nổi tiếng như Hải đăng, Bạch Dinh..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-xl text-sm outline-none transition-all resize-none"
                />
              </div>

              {/* Image Upload / URL */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Hình ảnh đại diện</label>
                <div className="flex flex-col gap-3">
                  {imagePreviewUrl ? (
                    <div className="relative w-full h-40 rounded-2xl border border-gray-100 overflow-hidden bg-gray-50 flex items-center justify-center">
                      <img src={imagePreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedImageFile(null);
                          setImagePreviewUrl('');
                          setForm(f => ({ ...f, imageUrl: '' }));
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-full transition-colors shadow-sm animate-in fade-in"
                        title="Xóa ảnh"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/10 cursor-pointer rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center gap-2 group"
                    >
                      <div className="p-3 bg-gray-50 group-hover:bg-blue-50 rounded-xl transition-all">
                        <Upload className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">Click để chọn hoặc kéo thả ảnh</p>
                        <p className="text-[10px] text-gray-400 mt-1">Chấp nhận JPG, PNG, WEBP tối đa 10MB</p>
                      </div>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedImageFile(file);
                        setImagePreviewUrl(URL.createObjectURL(file));
                      }
                    }}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 font-semibold block uppercase tracking-wider whitespace-nowrap">Hoặc nhập URL:</span>
                    <input
                      type="url"
                      value={form.imageUrl}
                      onChange={e => {
                        const val = e.target.value;
                        setForm(f => ({ ...f, imageUrl: val }));
                        setImagePreviewUrl(val);
                        setSelectedImageFile(null);
                      }}
                      placeholder="https://example.com/image.jpg"
                      className="flex-1 px-3 py-1.5 bg-gray-50 border border-transparent focus:border-blue-400 focus:bg-white rounded-xl text-xs outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Search and Select Places */}
              <div className="space-y-1.5 relative" ref={placeDropdownRef}>
                <label className="text-sm font-semibold text-gray-700">Địa điểm cần Check-in *</label>

                {/* Selected Places Badges */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.requiredPlaceIds.map(placeId => {
                    const name = placeCache[placeId]?.name || placeId;
                    return (
                      <span
                        key={placeId}
                        className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-xl"
                      >
                        <MapPin className="w-3.5 h-3.5 text-blue-500" />
                        {name}
                        <button
                          type="button"
                          onClick={() => handleRemovePlaceId(placeId)}
                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded-full p-0.5"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                  {form.requiredPlaceIds.length === 0 && (
                    <span className="text-xs text-gray-400 italic">Chưa có địa điểm nào được chọn.</span>
                  )}
                </div>

                {/* Search Input for Dropdown */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm để thêm địa điểm check-in..."
                    value={formPlaceSearch}
                    onFocus={() => setShowPlaceDropdown(true)}
                    onChange={e => {
                      setShowPlaceDropdown(true);
                      handleFormPlaceSearch(e.target.value);
                    }}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-xl text-sm outline-none transition-all"
                  />
                  {searchingFormPlaces && (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500 absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>

                {/* Place Search Results Dropdown */}
                {showPlaceDropdown && (
                  <div className="absolute left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-white border border-gray-100 rounded-2xl shadow-xl z-50 p-2 space-y-1">
                    {formPlaceResults.length === 0 ? (
                      <div className="py-4 text-center text-xs text-gray-400">
                        {formPlaceSearch.trim() ? 'Không tìm thấy địa điểm nào' : 'Gõ từ khóa để tìm kiếm địa điểm'}
                      </div>
                    ) : (
                      formPlaceResults.map(p => {
                        const isSelected = form.requiredPlaceIds.includes(p.placeId);
                        return (
                          <button
                            key={p.placeId}
                            type="button"
                            disabled={isSelected}
                            onClick={() => handleAddPlaceId(p.placeId, p)}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors ${
                              isSelected ? 'bg-gray-50 text-gray-400' : 'hover:bg-blue-50/60'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-bold text-gray-900 truncate">{p.name}</p>
                              <p className="text-[10px] text-gray-500 truncate">{p.address || p.city}</p>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Reward Section */}
              <div className="p-4 bg-slate-50 rounded-2xl space-y-3.5 border border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Phần thưởng hoàn thành</span>

                {/* Reward Type Selection */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: 'points', label: 'Tặng Điểm', icon: Coins, color: 'text-amber-600 bg-amber-50 border-amber-100' },
                    { type: 'souvenir', label: 'Quà Lưu Niệm', icon: Tag, color: 'text-rose-600 bg-rose-50 border-rose-100' },
                    { type: 'checkin_frame', label: 'Khung Hình', icon: Image, color: 'text-purple-600 bg-purple-50 border-purple-100' },
                  ].map(r => {
                    const Icon = r.icon;
                    const isSelected = form.rewardType === r.type;
                    return (
                      <button
                        key={r.type}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, rewardType: r.type as any }))}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1.5 ${
                          isSelected
                            ? `${r.color} border-blue-500 font-bold scale-102 shadow-sm`
                            : 'border-transparent bg-white hover:bg-gray-100 text-gray-500'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs">{r.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Reward values inputs */}
                {form.rewardType === 'points' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Số điểm Xu thưởng *</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={form.pointsAmount}
                      onChange={e => setForm(f => ({ ...f, pointsAmount: Number(e.target.value) }))}
                      placeholder="Nhập số xu thưởng"
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                )}

                {form.rewardType === 'souvenir' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">ID Quà lưu niệm (souvenirId) *</label>
                    <input
                      type="text"
                      required
                      value={form.souvenirId}
                      onChange={e => setForm(f => ({ ...f, souvenirId: e.target.value }))}
                      placeholder="VD: souvenir_vungtau_keychain"
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                )}

                {form.rewardType === 'checkin_frame' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Khung hình Check-in (unlockType = "mission") *</label>
                    {loadingFrames ? (
                      <div className="text-xs text-gray-400 flex items-center gap-1.5 py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Đang tải danh sách khung hình...
                      </div>
                    ) : (
                      <select
                        value={form.frameId}
                        required
                        onChange={e => setForm(f => ({ ...f, frameId: e.target.value }))}
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none transition-all cursor-pointer"
                      >
                        <option value="">-- Chọn Khung hình --</option>
                        {missionFrames.map(frame => (
                          <option key={frame._id} value={frame._id}>
                            {frame.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {missionFrames.length === 0 && !loadingFrames && (
                      <p className="text-[10px] text-red-500">
                        ⚠️ Chưa có Khung hình nào có "Cách mở khóa = Quà mission" (unlockType: "mission"). Vui lòng tạo frame đó trước.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Dates grid */}
              <div className="grid grid-cols-2 gap-3">
                <CustomDateTimePicker
                  label="Ngày bắt đầu"
                  value={form.startsAt}
                  onChange={val => setForm(f => ({ ...f, startsAt: val }))}
                />
                <CustomDateTimePicker
                  label="Ngày kết thúc"
                  value={form.endsAt}
                  onChange={val => setForm(f => ({ ...f, endsAt: val }))}
                />
              </div>

              {/* Order & Active toggle */}
              <div className="grid grid-cols-2 gap-3 items-center pt-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Thứ tự hiển thị (order)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.order}
                    onChange={e => setForm(f => ({ ...f, order: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-xl text-sm outline-none transition-all"
                  />
                </div>

                <div className="flex items-center gap-3 pt-6 pl-4">
                  <input
                    type="checkbox"
                    id="isActiveCheckbox"
                    checked={form.isActive}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                    className="w-4.5 h-4.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="isActiveCheckbox" className="text-sm font-semibold text-gray-700 cursor-pointer">
                    Kích hoạt hiển thị
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl text-sm disabled:opacity-70 transition-all shadow-lg shadow-blue-500/25"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    editingMission ? 'Lưu thay đổi' : 'Tạo nhiệm vụ'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====== Delete Confirmation Modal ====== */}
      {isDeleteOpen && deletingMission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Xác nhận xóa nhiệm vụ</h2>
              <p className="text-sm text-gray-500 mb-1">Bạn muốn xóa nhiệm vụ</p>
              <p className="text-sm font-bold text-gray-900 mb-4">"{deletingMission.title}"</p>
              <p className="text-xs text-red-500 bg-red-50 rounded-xl p-2.5 mb-5">
                ⚠️ Hành động này sẽ xóa vĩnh viễn cấu hình nhiệm vụ và không thể hoàn tác!
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleteOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDeleteMission}
                  disabled={isDeleting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm disabled:opacity-70 transition-all"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Xóa nhiệm vụ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
