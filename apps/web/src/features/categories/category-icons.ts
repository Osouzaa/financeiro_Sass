import {
  Briefcase,
  Car,
  CircleEllipsis,
  CirclePlus,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  PartyPopper,
  PawPrint,
  Percent,
  ShoppingBag,
  Sparkles,
  Tag,
  TrendingUp,
  Undo2,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

/** Ícones das categorias, pelo nome salvo no banco (padrão lucide). */
const ICONS: Record<string, LucideIcon> = {
  house: House,
  utensils: UtensilsCrossed,
  car: Car,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  'party-popper': PartyPopper,
  'shopping-bag': ShoppingBag,
  sparkles: Sparkles,
  'paw-print': PawPrint,
  landmark: Landmark,
  percent: Percent,
  'circle-ellipsis': CircleEllipsis,
  briefcase: Briefcase,
  laptop: Laptop,
  'trending-up': TrendingUp,
  'undo-2': Undo2,
  'circle-plus': CirclePlus,
};

export function categoryIcon(name: string | null): LucideIcon {
  return (name && ICONS[name]) || Tag;
}
