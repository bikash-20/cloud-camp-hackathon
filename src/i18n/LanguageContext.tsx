import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Language = 'en' | 'bn';

const LANGUAGE_KEY = 'nutrivision-language';

const bnPhrases: Record<string, string> = {
  'Good morning': 'শুভ সকাল',
  'Good afternoon': 'শুভ দুপুর',
  'Good evening': 'শুভ সন্ধ্যা',
  'Hello': 'হ্যালো',
  'App navigation': 'অ্যাপ নেভিগেশন',
  'Take a photo': 'ছবি তুলুন',
  'Capture': 'ক্যামেরা',
  'Results': 'ফলাফল',
  'Nutrients': 'পুষ্টি',
  'Profile': 'প্রোফাইল',
  'Grocery': 'বাজার',
  'Shop smart': 'স্মার্ট বাজার',
  'Your plate': 'আপনার খাবার',
  'Your meal': 'আপনার খাবার',
  'Every bite has a story.': 'প্রতিটি লোকমারই একটি গল্প আছে।',
  'Snap your plate — we\'ll do the rest.': 'আপনার খাবারের ছবি তুলুন—বাকিটা আমরা সামলে নেব।',
  'Snap': 'ছবি তুলুন',
  'we\'ll do the rest.': 'বাকিটা আমরা সামলে নেব।',
  'Open Camera': 'ক্যামেরা খুলুন',
  'Tap to open Camera': 'ক্যামেরা খুলতে চাপ দিন',
  'Plate, ingredients, or a menu — all work': 'প্লেট, উপকরণ বা মেনু—সবই চলবে',
  'Or upload a photo': 'অথবা ছবি আপলোড করুন',
  'Tap the card to open your camera': 'ক্যামেরা খুলতে কার্ডে চাপ দিন',
  'Log Meal': 'খাবার নথিভুক্ত করুন',
  'Recent': 'সাম্প্রতিক',
  'menu': 'মেনু',
  'all work': 'সবই চলবে',
  'Detected items': 'শনাক্ত করা আইটেম',
  'Analyzing photo…': 'ছবি বিশ্লেষণ করা হচ্ছে…',
  'Analysis unavailable — no sample results shown.': 'বিশ্লেষণ করা যাচ্ছে না—কোনো নমুনা ফলাফল দেখানো হয়নি।',
  'Could not analyze this photo. Check your connection and provider setup.': 'ছবিটি বিশ্লেষণ করা যায়নি। সংযোগ ও প্রোভাইডার সেটআপ পরীক্ষা করুন।',
  'No food was detected. Try a clearer photo.': 'কোনো খাবার শনাক্ত হয়নি। আরও পরিষ্কার ছবি দিয়ে চেষ্টা করুন।',
  'Enter edit mode': 'সম্পাদনার মোডে যান',
  'Share detected items': 'শনাক্ত করা আইটেম শেয়ার করুন',
  'selected': 'নির্বাচিত',
  'mode': 'মোড',
  'No items to review. Tap + to add a custom item.': 'পর্যালোচনার জন্য কোনো আইটেম নেই। নিজে খাবার যোগ করতে + চাপ দিন।',
  'Sort: By Confidence. Tap to change.': 'সাজান: নিশ্চয়তার ভিত্তিতে। পরিবর্তন করতে চাপ দিন।',
  'Sort: By Confidence': 'সাজান: নিশ্চয়তার ভিত্তিতে',
  'By Calories (high → low)': 'ক্যালরি অনুযায়ী (বেশি থেকে কম)',
  'By Portion Size': 'পরিমাণ অনুযায়ী',
  'Alphabetical': 'বর্ণানুক্রমে',
  'Sort': 'সাজান',
  'By Confidence': 'নিশ্চয়তার ভিত্তিতে',
  'Tap to change.': 'পরিবর্তন করতে চাপ দিন।',
  're-ranked': 'পুনরায় সাজানো হয়েছে',
  'Re-ranked for your diabetic profile': 'আপনার ডায়াবেটিস প্রোফাইল অনুযায়ী পুনরায় সাজানো হয়েছে',
  'Collapse summary': 'সারাংশ বন্ধ করুন',
  'Expand summary': 'সারাংশ খুলুন',
  'items': 'আইটেম',
  'item': 'আইটেম',
  'All items confirmed!': 'সব আইটেম নিশ্চিত করা হয়েছে!',
  'Copied to clipboard': 'ক্লিপবোর্ডে কপি করা হয়েছে',
  'Confirmed selected': 'নির্বাচিত আইটেম নিশ্চিত করা হয়েছে',
  'Confirmed': 'নিশ্চিত করা হয়েছে',
  'protein': 'প্রোটিন',
  'carbs': 'কার্বোহাইড্রেট',
  'fat': 'চর্বি',
  'calories': 'ক্যালরি',
  'Add items': 'আইটেম যোগ করুন',
  'This week\'s list': 'এই সপ্তাহের তালিকা',
  'This week’s list': 'এই সপ্তাহের তালিকা',
  'spent': 'খরচ হয়েছে',
  'left': 'বাকি',
  'left of': 'বাকি',
  'Share list': 'তালিকা শেয়ার করুন',
  'Share Grocery list': 'বাজারের তালিকা শেয়ার করুন',
  'Your grocery list is empty': 'আপনার বাজারের তালিকা খালি',
  'Snap a meal or add items manually': 'খাবারের ছবি তুলুন অথবা নিজে আইটেম যোগ করুন',
  'Viewing': 'দেখছেন',
  'empty': 'খালি',
  'Share': 'শেয়ার',
  'list': 'তালিকা',
  'items manually': 'আইটেম নিজে যোগ করুন',
  'This week': 'এই সপ্তাহ',
  'Today\'s list': 'আজকের তালিকা',
  'Today’s list': 'আজকের তালিকা',
  'Analyzing your plate…': 'আপনার খাবার বিশ্লেষণ করা হচ্ছে…',
  'Analyzing your plate...': 'আপনার খাবার বিশ্লেষণ করা হচ্ছে...',
  'Analysis complete': 'বিশ্লেষণ সম্পন্ন',
  'Camera permission denied': 'ক্যামেরা ব্যবহারের অনুমতি দেওয়া হয়নি',
  'No camera found': 'কোনো ক্যামেরা পাওয়া যায়নি',
  'Camera unavailable': 'ক্যামেরা ব্যবহার করা যাচ্ছে না',
  'Use photo': 'ছবি ব্যবহার করুন',
  'Upload photo': 'ছবি আপলোড করুন',
  'Take another photo': 'আরেকটি ছবি তুলুন',
  'Retake': 'আবার তুলুন',
  'Choose from gallery': 'গ্যালারি থেকে বেছে নিন',
  'Today': 'আজ',
  'Today so far': 'আজকের হিসাব',
  'Today’s progress': 'আজকের অগ্রগতি',
  "Today's progress": 'আজকের অগ্রগতি',
  'No meals yet today': 'আজ এখনো কোনো খাবার যোগ হয়নি',
  'snap your first': 'ট্র্যাক করতে প্রথম খাবারের ছবি তুলুন',
  'Recent meals': 'সাম্প্রতিক খাবার',
  'See all': 'সব দেখুন',
  'Daily goal': 'দৈনিক লক্ষ্য',
  'Calories': 'ক্যালরি',
  'Carbs': 'কার্বোহাইড্রেট',
  'Carbohydrates': 'কার্বোহাইড্রেট',
  'Fat': 'চর্বি',
  'Fiber': 'আঁশ',
  'Fibre': 'আঁশ',
  'Sodium': 'সোডিয়াম',
  'Sugar': 'চিনি',
  'kcal': 'কিলোক্যালরি',
  'Your results': 'আপনার ফলাফল',
  'Food detected': 'শনাক্ত করা খাবার',
  'Detected foods': 'শনাক্ত করা খাবার',
  'Confidence': 'নিশ্চয়তা',
  'Portion size': 'পরিমাণ',
  'Estimated portion': 'আনুমানিক পরিমাণ',
  'Nutrition facts': 'পুষ্টিগুণ',
  'Nutrition details': 'পুষ্টির বিস্তারিত',
  'View nutrients': 'পুষ্টির তথ্য দেখুন',
  'View nutrition': 'পুষ্টির তথ্য দেখুন',
  'Edit': 'সম্পাদনা',
  'Remove': 'সরান',
  'Add food': 'খাবার যোগ করুন',
  'Add item': 'আইটেম যোগ করুন',
  'Add custom item': 'নিজে খাবার যোগ করুন',
  'Save': 'সংরক্ষণ করুন',
  'Cancel': 'বাতিল',
  'Done': 'সম্পন্ন',
  'Back': 'ফিরে যান',
  'Next': 'পরবর্তী',
  'Meal saved': 'খাবার সংরক্ষিত হয়েছে',
  'Meal history': 'খাবারের ইতিহাস',
  'Today’s meals': 'আজকের খাবার',
  'Today\'s meals': 'আজকের খাবার',
  'Daily summary': 'দৈনিক সারাংশ',
  'Nutrition summary': 'পুষ্টির সারাংশ',
  'Your Stats': 'আপনার পরিসংখ্যান',
  'Your stats': 'আপনার পরিসংখ্যান',
  'Health goals': 'স্বাস্থ্য লক্ষ্য',
  'Dietary preferences': 'খাদ্যাভ্যাসের পছন্দ',
  'Allergens to avoid': 'যেসব অ্যালার্জি এড়াবেন',
  'Daily kcal target': 'দৈনিক ক্যালরি লক্ষ্য',
  'Daily calorie target': 'দৈনিক ক্যালরি লক্ষ্য',
  'Daily grocery budget': 'দৈনিক বাজারের বাজেট',
  'Servings on this plate': 'এই প্লেটের পরিবেশনের সংখ্যা',
  'meals logged': 'নথিভুক্ত খাবার',
  'days active': 'সক্রিয় দিন',
  'avg kcal/day': 'গড় কিলোক্যালরি/দিন',
  'Dhaka, Bangladesh': 'ঢাকা, বাংলাদেশ',
  'Profile name': 'প্রোফাইলের নাম',
  'per day': 'প্রতিদিন',
  'per day — the Grocery screen applies this as a weekly cap of': 'প্রতিদিন—বাজারের পর্দায় এটি সাপ্তাহিক সীমা হিসেবে প্রয়োগ হয়:',
  'weekly cap': 'সাপ্তাহিক সীমা',
  'Add': 'যোগ করুন',
  'Shell shellfish': 'শেলফিশ',
  'servings': 'পরিবেশন',
  'serving': 'পরিবেশন',
  '12-day streak': 'টানা ১২ দিনের ধারা',
  'Health conditions': 'স্বাস্থ্যগত অবস্থা',
  'Diabetes-friendly': 'ডায়াবেটিস-বান্ধব',
  'High protein': 'উচ্চ প্রোটিন',
  'Budget friendly': 'বাজেট-বান্ধব',
  'Mediterranean': 'মেডিটেরেনিয়ান',
  'Goals': 'লক্ষ্য',
  'Settings': 'সেটিংস',
  'Reset profile': 'প্রোফাইল রিসেট করুন',
  'Your health profile': 'আপনার স্বাস্থ্য প্রোফাইল',
  'Reset profile to defaults': 'প্রোফাইলের ডিফল্ট সেটিংস ফিরিয়ে আনুন',
  'Sign out of NutriVision': 'NutriVision থেকে সাইন আউট',
  'Hi': 'হ্যালো',
  'these shape every flag and swap you see.': 'এগুলো আপনার দেখা প্রতিটি সতর্কতা ও বিকল্প নির্ধারণ করে।',
  'Edit profile name': 'প্রোফাইলের নাম সম্পাদনা করুন',
  'Prediabetic-friendly': 'প্রিডায়াবেটিস-বান্ধব',
  'High-protein': 'উচ্চ প্রোটিন',
  'Budget-aware': 'বাজেট-সচেতন',
  'Toggle': 'পরিবর্তন করুন',
  'goal': 'লক্ষ্য',
  'Vegetarian': 'নিরামিষভোজী',
  'Vegan': 'ভেগান',
  'Pescatarian': 'মাছসহ নিরামিষভোজী',
  'Gluten-free': 'গ্লুটেনমুক্ত',
  'Dairy-free': 'দুগ্ধজাত খাবারমুক্ত',
  'Halal': 'হালাল',
  'Kosher': 'কোশার',
  'Peanuts': 'চিনাবাদাম',
  'Tree nuts': 'গাছের বাদাম',
  'Shellfish': 'শেলফিশ',
  'Soy': 'সয়া',
  'Eggs': 'ডিম',
  'Dairy': 'দুগ্ধজাত খাবার',
  'Gluten': 'গ্লুটেন',
  'Sesame': 'তিল',
  'Dark': 'ডার্ক',
  'Light': 'লাইট',
  'Reset': 'রিসেট',
  'defaults': 'ডিফল্ট',
  'Home progress bar': 'হোমের অগ্রগতি বার',
  'powers the Home progress bar — defaults to 2000 kcal/day': 'হোমের অগ্রগতি বার চালায়—ডিফল্ট দৈনিক লক্ষ্য ২০০০ কিলোক্যালরি',
  'the Grocery screen applies this as a weekly cap of': 'বাজারের পর্দায় এটি সাপ্তাহিক সীমা হিসেবে প্রয়োগ হয়:',
  'used to scale macro values across Nutrients': 'পুষ্টি বিভাগে ম্যাক্রোর মান সমন্বয়ে ব্যবহৃত হয়',
  'Decrease servings': 'পরিবেশনের সংখ্যা কমান',
  'Increase servings': 'পরিবেশনের সংখ্যা বাড়ান',
  'Decrease daily kcal target by 50': 'দৈনিক ক্যালরির লক্ষ্য ৫০ কমান',
  'Increase daily kcal target by 50': 'দৈনিক ক্যালরির লক্ষ্য ৫০ বাড়ান',
  'Decrease budget by 50 taka': 'বাজেট ৫০ টাকা কমান',
  'Increase budget by 50 taka': 'বাজেট ৫০ টাকা বাড়ান',
  'Sign out': 'সাইন আউট',
  'Log out': 'লগ আউট',
  'Welcome back': 'আবার স্বাগতম',
  'Sign in': 'সাইন ইন',
  'Email': 'ইমেইল',
  'Password': 'পাসওয়ার্ড',
  'Email address': 'ইমেইল ঠিকানা',
  'Enter your email': 'আপনার ইমেইল লিখুন',
  'Enter your password': 'আপনার পাসওয়ার্ড লিখুন',
  'Invalid email or password': 'ইমেইল বা পাসওয়ার্ড সঠিক নয়',
  'Forgot password?': 'পাসওয়ার্ড ভুলে গেছেন?',
  'Admin': 'অ্যাডমিন',
  'User': 'ব্যবহারকারী',
  'Dashboard': 'ড্যাশবোর্ড',
  'Overview': 'সারসংক্ষেপ',
  'Total users': 'মোট ব্যবহারকারী',
  'Meals analyzed': 'বিশ্লেষণ করা খাবার',
  'Active today': 'আজ সক্রিয়',
  'Users': 'ব্যবহারকারীরা',
  'Top foods': 'জনপ্রিয় খাবার',
  'Flagged queue': 'পর্যালোচনার তালিকা',
  'Soon': 'শীঘ্রই',
  'Menu': 'মেনু',
  'Close menu': 'মেনু বন্ধ করুন',
  'Open menu': 'মেনু খুলুন',
  'Admin navigation': 'অ্যাডমিন নেভিগেশন',
  'Admin sections': 'অ্যাডমিন বিভাগ',
  'Signed in': 'সাইন ইন করা হয়েছে',
  'Signed in as': 'সাইন ইন করেছেন',
  'This meal, explained': 'এই খাবারের পুষ্টি বিশ্লেষণ',
  'Share nutrition summary': 'পুষ্টির সারাংশ শেয়ার করুন',
  'Filtered for your prediabetic-friendly goal.': 'আপনার প্রিডায়াবেটিস-বান্ধব লক্ষ্যের জন্য বাছাই করা হয়েছে।',
  'Personalized against your active goals.': 'আপনার সক্রিয় লক্ষ্য অনুযায়ী ব্যক্তিগতকৃত।',
  'Micronutrients': 'অণুপুষ্টি',
  'Daily reference values': 'দৈনিক নির্দেশক মান',
  'vs targets': 'লক্ষ্যের তুলনায়',
  'target': 'লক্ষ্য',
  'total': 'মোট',
  'Why these flags?': 'এই সতর্কতাগুলো কেন?',
  'SHAP-style': 'SHAP-ধাঁচের',
  'Why we flagged this': 'এটি কেন সতর্ক করা হয়েছে',
  'Per-item reasoning': 'প্রতিটি আইটেমের ব্যাখ্যা',
  'Per-item verdict explanations': 'প্রতিটি আইটেমের মূল্যায়নের ব্যাখ্যা',
  'Meal verdict': 'খাবারের মূল্যায়ন',
  'Why this is flagged:': 'সতর্কতার কারণ:',
  'Sign out of admin': 'অ্যাডমিন থেকে সাইন আউট',
  'Good to see you,': 'আপনাকে দেখে ভালো লাগছে,',
  'Synthetic demo accounts plus your own activity. Numbers update as you log meals.': 'ডেমো অ্যাকাউন্টের সঙ্গে আপনার কার্যকলাপ। খাবার যোগ করলে সংখ্যাগুলো হালনাগাদ হবে।',
  'Meals today': 'আজকের খাবার',
  'across all users': 'সব ব্যবহারকারী মিলিয়ে',
  'Meals this week': 'এই সপ্তাহের খাবার',
  'last 7 days': 'গত ৭ দিন',
  'Avg / user / week': 'ব্যবহারকারীপ্রতি সাপ্তাহিক গড়',
  '5 seeded + you': '৫টি ডেমো + আপনি',
  '7-day meal volume': '৭ দিনের খাবারের পরিমাণ',
  'How many meals landed on each day across all users.': 'সব ব্যবহারকারীর প্রতিদিনের খাবারের সংখ্যা।',
  'Key performance indicators': 'মূল কার্যকারিতা সূচক',
  'Flagged detection summary': 'চিহ্নিত শনাক্তকরণের সারাংশ',
  'Flagged items': 'চিহ্নিত আইটেম',
  'items below 70% confidence': 'টি আইটেমের নিশ্চয়তা ৭০%-এর কম',
  'Add to home screen for quick access': 'দ্রুত ব্যবহারের জন্য হোম স্ক্রিনে যোগ করুন',
  'Install NutriVision': 'NutriVision ইনস্টল করুন',
  'Installing…': 'ইনস্টল হচ্ছে…',
  'Install NutriVision AI app': 'NutriVision AI অ্যাপ ইনস্টল করুন',
  'Install app': 'অ্যাপ ইনস্টল করুন',
  'Install': 'ইনস্টল',
  'Dismiss install banner': 'ইনস্টল ব্যানার বন্ধ করুন',
  'Dismiss': 'বন্ধ করুন',
  'View captured photo': 'তোলা ছবি দেখুন',
  'Captured meal': 'তোলা খাবার',
  'Camera': 'ক্যামেরা',
  'Gallery': 'গ্যালারি',
  'Search': 'খুঁজুন',
  'Search foods': 'খাবার খুঁজুন',
  'Search grocery items': 'বাজারের পণ্য খুঁজুন',
  'Generate list': 'তালিকা তৈরি করুন',
  'Grocery list': 'বাজারের তালিকা',
  'Shopping list': 'কেনাকাটার তালিকা',
  'Add to grocery list': 'বাজারের তালিকায় যোগ করুন',
  'Clear all': 'সব মুছুন',
  'Clear list': 'তালিকা মুছুন',
  'Checked': 'কেনা হয়েছে',
  'Remaining': 'বাকি',
  'Total': 'মোট',
  'Budget': 'বাজেট',
  'Over budget': 'বাজেট ছাড়িয়েছে',
  'Under budget': 'বাজেটের মধ্যে',
  'Estimated': 'আনুমানিক',
  'Estimated nutrition': 'আনুমানিক পুষ্টিগুণ',
  'Low confidence — tap to confirm': 'নিশ্চয়তা কম — নিশ্চিত করতে চাপ দিন',
  'Low confidence': 'নিশ্চয়তা কম',
  'High confidence': 'নিশ্চয়তা বেশি',
  'Tap to confirm': 'নিশ্চিত করতে চাপ দিন',
  'Confirm': 'নিশ্চিত করুন',
  'Review': 'পর্যালোচনা',
  'Adjust': 'পরিমাণ ঠিক করুন',
  'Selected': 'নির্বাচিত',
  'Review all selected items': 'নির্বাচিত সব আইটেম পর্যালোচনা করুন',
  'Confirm all selected high-confidence items': 'নির্বাচিত উচ্চ-নিশ্চয়তার সব আইটেম নিশ্চিত করুন',
  'Bulk actions': 'একাধিক আইটেমের কাজ',
  'Exit multi-select mode': 'একাধিক নির্বাচন থেকে বের হন',
  'Select all': 'সব নির্বাচন করুন',
  'Sort by': 'সাজান',
  'Filter': 'ফিল্টার',
  'All': 'সব',
  'No results found': 'কোনো ফলাফল পাওয়া যায়নি',
  'No meals found': 'কোনো খাবার পাওয়া যায়নি',
  'No meal analyzed yet': 'এখনো কোনো খাবার বিশ্লেষণ করা হয়নি',
  'Start by snapping a photo of your plate!': 'শুরু করতে আপনার খাবারের একটি ছবি তুলুন!',
  'Back to results': 'ফলাফলে ফিরে যান',
  'Try again': 'আবার চেষ্টা করুন',
  'Something went wrong': 'কিছু একটা সমস্যা হয়েছে',
  'The demo hit an unexpected error. You can try again, or reload the page if it keeps happening.': 'অপ্রত্যাশিত সমস্যা হয়েছে। আবার চেষ্টা করুন, অথবা সমস্যা থাকলে পৃষ্ঠা রিলোড করুন।',
  'Switch to light mode': 'লাইট মোড চালু করুন',
  'Switch to dark mode': 'ডার্ক মোড চালু করুন',
  'English': 'English',
  'Step': 'ধাপ',
  'Go to': 'যান',
  'of': 'এর',
  'from history': 'ইতিহাস থেকে',
  'per 100g': 'প্রতি ১০০ গ্রাম',
  'per 100 g': 'প্রতি ১০০ গ্রাম',
  'day': 'দিন',
  'days': 'দিন',
  'Breakfast': 'সকালের নাশতা',
  'Lunch': 'দুপুরের খাবার',
  'Dinner': 'রাতের খাবার',
  'Snack': 'হালকা খাবার',
  'Khichuri': 'খিচুড়ি',
  'Khichuri with egg': 'ডিম দিয়ে খিচুড়ি',
  'Bhat': 'ভাত',
  'Rice': 'ভাত',
  'Dal': 'ডাল',
  'Dal (lentils)': 'ডাল',
  'Fish curry': 'মাছের তরকারি',
  'Chicken curry': 'মুরগির তরকারি',
  'Chicken biryani': 'চিকেন বিরিয়ানি',
  'Biryani': 'বিরিয়ানি',
  'Beef curry': 'গরুর মাংসের তরকারি',
  'Beef bhuna': 'গরুর ভুনা',
  'Alu bhorta': 'আলু ভর্তা',
  'Aloo bhorta': 'আলু ভর্তা',
  'Bhorta': 'ভর্তা',
  'Bhaji': 'ভাজি',
  'Shak bhaji': 'শাক ভাজি',
  'Roti': 'রুটি',
  'Paratha': 'পরোটা',
  'Panta bhat': 'পান্তা ভাত',
  'Hilsa curry': 'ইলিশের তরকারি',
  'Ilish': 'ইলিশ',
  'Cucumber raita': 'শসার রায়তা',
  'Mixed salad': 'মিশ্র সালাদ',
  'Pickled onion': 'আচার করা পেঁয়াজ',
  'Boiled egg': 'সিদ্ধ ডিম',
  'Grilled chicken': 'গ্রিল করা মুরগি',
  'Steamed broccoli': 'ভাপে সেদ্ধ ব্রকলি',
  'Whole wheat roti': 'আটার রুটি',
  'Paneer tikka': 'পনির টিক্কা',
  'Greek yogurt': 'গ্রিক দই',
  'Avocado toast': 'অ্যাভোকাডো টোস্ট',
  'Brown rice': 'লাল চালের ভাত',
  'Naan': 'নান',
  'Mint chutney': 'পুদিনার চাটনি',
  'Water': 'পানি',
  'Fruit': 'ফল',
  'Vegetables': 'সবজি',
  'Protein': 'প্রোটিন',
  'Produce': 'শাকসবজি',
  'Grains': 'শস্য',
  'Other': 'অন্যান্য',
};

const phraseLookup = new Map(
  Object.entries(bnPhrases).map(([english, bengali]) => [english.toLowerCase(), bengali]),
);
const phrasePattern = new RegExp(
  `(^|[^A-Za-z])(${Object.keys(bnPhrases)
    .sort((a, b) => b.length - a.length)
    .map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})(?=$|[^A-Za-z])`,
  'gi',
);

function translateText(value: string): string {
  return value.replace(phrasePattern, (_match, prefix: string, phrase: string) =>
    `${prefix}${phraseLookup.get(phrase.toLowerCase()) ?? phrase}`,
  );
}

export function translateBengali(value: string): string {
  return translateText(value);
}

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  translate: (value: string) => string;
  foodName: (name: string, bengaliName?: string | null) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function initialLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_KEY);
    if (saved === 'en' || saved === 'bn') return saved;
    return navigator.language.toLowerCase().startsWith('bn') ? 'bn' : 'en';
  } catch {
    return 'en';
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      // The selected language still applies for the current session.
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      translate: language === 'bn' ? translateText : (text) => text,
      foodName: (name, bengaliName) =>
        language === 'bn' ? (bengaliName?.trim() || translateText(name)) : name,
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}

const LOCALIZED_ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'alt'] as const;

export function LocalizedContent({ children }: { children: ReactNode }) {
  const { language, translate } = useLanguage();
  if (language === 'en') return <>{children}</>;

  const localize = (node: ReactNode): ReactNode => {
    if (typeof node === 'string') return translate(node);
    if (Array.isArray(node)) return Children.toArray(node).map(localize);
    if (!isValidElement<{ children?: ReactNode }>(node)) return node;

    const props: Record<string, unknown> = { ...node.props };
    for (const attribute of LOCALIZED_ATTRIBUTES) {
      const value = props[attribute];
      if (typeof value === 'string') props[attribute] = translate(value);
    }
    if (node.props.children !== undefined) props.children = localize(node.props.children);
    return cloneElement(node, props);
  };

  return <>{localize(children)}</>;
}
