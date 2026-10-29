import type { UserProfile } from '../types/schemas';

export interface DemoPersona {
  id: 'rafi' | 'ananya' | 'tanveer';
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
  {
    id: 'ananya',
    name: 'Ananya',
    nameBn: 'অনন্যা',
    badge: 'Vegetarian · High Protein',
    badgeBn: 'নিরামিষ · উচ্চ প্রোটিন',
    desc: '27y, 54kg, active, target high protein, no meat/fish',
    descBn: '২৭ বছর, ৫৪ কেজি, খুব সক্রিয়, উচ্চ প্রোটিন ও নিরামিষ খাদ্য',
    profile: {
      name: 'Ananya',
      sex: 'female',
      age: 27,
      heightCm: 162,
      weightKg: 54,
      heightUnit: 'cm',
      weightUnit: 'kg',
      activityLevel: 'active',
      goal: 'maintain',
      targetRateKgPerWeek: 0,
      dietType: 'vegetarian',
      medicalConditions: ['none'],
      mealsPerDay: 3,
      goals: { diabetic: false, protein: true, budget: false, mediter: false },
      preferences: ['Vegetarian'],
      allergens: ['Peanuts'],
      budget: 600,
      serving: 1,
      dailyKcalTarget: 2190,
    },
  },
  {
    id: 'tanveer',
    name: 'Tanveer',
    nameBn: 'তানভীর',
    badge: 'Student · Budget ৳1500/wk',
    badgeBn: 'ছাত্র · সাশ্রয়ী বাজেট (৳১৫০০/সপ্তাহ)',
    desc: '21y, 68kg, moderate, student grocery budget ৳214/day',
    descBn: '২১ বছর, ৬৮ কেজি, মাঝারি ব্যায়াম, ছাত্র বাজেট দৈনিক ৳২১৪',
    profile: {
      name: 'Tanveer',
      sex: 'male',
      age: 21,
      heightCm: 175,
      weightKg: 68,
      heightUnit: 'cm',
      weightUnit: 'kg',
      activityLevel: 'moderate',
      goal: 'maintain',
      targetRateKgPerWeek: 0,
      dietType: 'halal',
      medicalConditions: ['none'],
      mealsPerDay: 3,
      goals: { diabetic: false, protein: false, budget: true, mediter: false },
      preferences: ['Halal'],
      allergens: [],
      budget: 214,
      serving: 1,
      dailyKcalTarget: 2570,
    },
  },
];

