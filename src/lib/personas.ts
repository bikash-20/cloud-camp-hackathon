import type { UserProfile } from '../types/schemas';

export interface DemoPersona {
  id: 'rafi';
  name: string;
  nameBn: string;
  badge: string;
  badgeBn: string;
  desc: string;
  descBn: string;
  profile: UserProfile;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: 'rafi',
    name: 'Rafi',
    nameBn: 'রাফি',
    badge: 'Diabetic · Halal',
    badgeBn: 'ডায়াবেটিস · হালাল',
    desc: '38y, 76kg, lightly active, restricted carbs & sodium',
    descBn: '৩৮ বছর, ৭৬ কেজি, হালকা সক্রিয়, কার্বোহাইড্রেট ও সোডিয়াম নিয়ন্ত্রণ',
    profile: {
      name: 'Rafi',
      sex: 'male',
      age: 38,
      heightCm: 172,
      weightKg: 76,
      heightUnit: 'cm',
      weightUnit: 'kg',
      activityLevel: 'light',
      goal: 'maintain',
      targetRateKgPerWeek: 0,
      dietType: 'halal',
      medicalConditions: ['diabetes_t2', 'hypertension'],
      mealsPerDay: 3,
      goals: { diabetic: true, protein: false, budget: false, mediter: false },
      preferences: ['Halal'],
      allergens: ['Peanuts'],
      budget: 500,
      serving: 1,
      dailyKcalTarget: 2255,
    },
  },
];

