import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '../../db';
import { GlassCard } from '../ui/GlassCard';
import { Save, Upload, Loader2, FileText, Receipt } from 'lucide-react';
import { clsx } from 'clsx';
import type { BusinessProfile } from '../../types';
import { DEFAULT_INVOICE_TERMS } from '../../lib/invoice';
import { DEFAULT_COUNTRY_CODE } from '../../lib/whatsapp';
import { BackupCard } from './BackupCard';
import { CatalogCard } from './CatalogCard';
import { DEFAULT_BRAND_COLOR } from '../../lib/color';

// 1. Define the Schema
const profileSchema = z.object({
  businessName: z.string().min(2, "Business name is required"),
  ownerName: z.string().optional(),
  address: z.string().min(5, "Address is required"),
  phone: z.string().min(10, "Valid phone number required"),
  email: z.string().email().optional().or(z.literal('')),
  bankName: z.string().min(2, "Bank name required"),
  // Not fixed to 10 digits (Nigerian NUBAN) so UK sort-code accounts and IBANs also fit
  accountNumber: z.string().min(4, "Account number required"),
  accountName: z.string().min(2, "Account name required"),
  invoiceFooterText: z.string().optional(),
  taxLabel: z.string().optional(),
  defaultTaxRate: z.coerce.number().min(0, "Must be 0 or more").max(100, "Must be 100 or less"),
  defaultDueDays: z.string(), // '' = no due date by default
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour"),
  invoiceTemplate: z.enum(['classic', 'modern']),
  defaultCountryCode: z.string().trim().regex(/^\+?\d{1,4}$/, "Digits only, e.g. 234"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;


export function BusinessProfileForm() {
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      invoiceFooterText: DEFAULT_INVOICE_TERMS,
      taxLabel: 'VAT',
      defaultTaxRate: 0,
      defaultDueDays: '',
      defaultCountryCode: DEFAULT_COUNTRY_CODE,
      brandColor: DEFAULT_BRAND_COLOR,
      invoiceTemplate: 'classic',
    }
  });

  // 2. Load existing data on mount
  useEffect(() => {
    async function loadProfile() {
      const profile = await db.businessProfile.orderBy('id').first();
      if (profile) {
        setValue('businessName', profile.businessName);
        setValue('ownerName', profile.ownerName || '');
        setValue('address', profile.address);
        setValue('phone', profile.phone);
        setValue('email', profile.email || '');
        setValue('bankName', profile.bankName);
        setValue('accountNumber', profile.accountNumber);
        setValue('accountName', profile.accountName);
        // Load saved terms or use default
        setValue('invoiceFooterText', profile.invoiceFooterText || DEFAULT_INVOICE_TERMS);
        setValue('taxLabel', profile.taxLabel || 'VAT');
        setValue('defaultTaxRate', profile.defaultTaxRate ?? 0);
        setValue('defaultDueDays', profile.defaultDueDays?.toString() ?? '');
        setValue('defaultCountryCode', profile.defaultCountryCode ?? DEFAULT_COUNTRY_CODE);
        setValue('brandColor', profile.brandColor ?? DEFAULT_BRAND_COLOR);
        setValue('invoiceTemplate', profile.invoiceTemplate ?? 'classic');

        if (profile.logoUrl) {
          setLogoPreview(profile.logoUrl);
        }
      }
    }
    loadProfile();
  }, [setValue]);

  // 3. Handle File Upload
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Logo must be under 2MB");
        return;
      }
      setLogoFile(file);
      const objectUrl = URL.createObjectURL(file);
      setLogoPreview(objectUrl);
    }
  };

  // 4. Save to Dexie DB
  const onSubmit = async (data: ProfileFormValues) => {
    setLoading(true);
    setSuccessMsg('');
    try {
      let finalLogoUrl = logoPreview;

      if (logoFile) {
        finalLogoUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(logoFile);
        });
      }

      const { defaultDueDays, ...rest } = data;
      const profileData: BusinessProfile = {
        ...rest,
        taxLabel: rest.taxLabel?.trim() || 'VAT',
        defaultCountryCode: rest.defaultCountryCode.replace(/\D/g, ''),
        defaultDueDays: defaultDueDays === '' ? undefined : Number(defaultDueDays),
        logoUrl: finalLogoUrl || undefined,
        // Ensure ID 1 is always used for the singleton profile
        id: 1,
      };

      await db.businessProfile.put(profileData);

      setSuccessMsg('Settings saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error(error);
      alert('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all";
  const labelClass = "block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider";

  return (
    <div className="max-w-2xl mx-auto pb-20">
      <h2 className="text-2xl font-bold text-white mb-6">Business Settings</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* Card 1: Brand & Contact */}
        <GlassCard className="p-6 md:p-8">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Upload size={20} className="text-indigo-400"/> Brand Identity
            </h3>

            <div className="flex items-center gap-6 mb-6">
                <div className={clsx(
                    "h-24 w-24 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center overflow-hidden bg-white/5",
                    logoPreview ? "border-solid border-indigo-500" : ""
                )}>
                    {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                    <span className="text-xs text-slate-500 text-center px-2">No Logo</span>
                    )}
                </div>
                <div>
                    <label htmlFor="logo-upload" className="cursor-pointer inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium">
                    <Upload size={16} />
                    Upload Logo
                    </label>
                    <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                    <p className="text-xs text-slate-500 mt-2">Recommended: Square PNG, max 2MB.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className={labelClass}>Business Name</label>
                <input {...register('businessName')} className={inputClass} placeholder="e.g. Acme Supplies Ltd" />
                {errors.businessName && <span className="text-red-400 text-xs">{errors.businessName.message}</span>}
            </div>
            <div>
                <label className={labelClass}>Owner Name</label>
                <input {...register('ownerName')} className={inputClass} placeholder="e.g. Ronke" />
            </div>
            <div>
                <label className={labelClass}>Phone</label>
                <input {...register('phone')} className={inputClass} placeholder="+234..." />
                {errors.phone && <span className="text-red-400 text-xs">{errors.phone.message}</span>}
            </div>
             <div>
                <label className={labelClass}>Email (Optional)</label>
                <input {...register('email')} className={inputClass} placeholder="hello@example.com" />
            </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className={labelClass}>Brand Colour</label>
                <div className="flex items-center gap-3">
                  <input type="color" {...register('brandColor')} className="h-11 w-14 rounded-lg bg-transparent border border-white/10 cursor-pointer" aria-label="Brand colour" />
                  <span className="text-xs text-slate-500">Used for your name, table headers and highlights on PDFs.</span>
                </div>
                {errors.brandColor && <span className="text-red-400 text-xs">{errors.brandColor.message}</span>}
              </div>
              <div>
                <label className={labelClass}>PDF Template</label>
                <select {...register('invoiceTemplate')} className={clsx(inputClass, "[&>option]:bg-slate-900")}>
                  <option value="classic">Classic (white header)</option>
                  <option value="modern">Modern (colour header band)</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
            <label className={labelClass}>Office Address</label>
            <textarea {...register('address')} rows={2} className={inputClass} placeholder="Full street address..." />
            {errors.address && <span className="text-red-400 text-xs">{errors.address.message}</span>}
            </div>
        </GlassCard>

        {/* Card 2: Bank Details */}
        <GlassCard className="p-6 md:p-8">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Save size={20} className="text-indigo-400"/> Payment Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Bank Name</label>
              <input {...register('bankName')} className={inputClass} placeholder="e.g. GTBank" />
              {errors.bankName && <span className="text-red-400 text-xs">{errors.bankName.message}</span>}
            </div>
            <div>
              <label className={labelClass}>Account Number</label>
              <input {...register('accountNumber')} className={inputClass} placeholder="0123456789" />
              {errors.accountNumber && <span className="text-red-400 text-xs">{errors.accountNumber.message}</span>}
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Account Name</label>
              <input {...register('accountName')} className={inputClass} placeholder="Account Holder Name" />
              {errors.accountName && <span className="text-red-400 text-xs">{errors.accountName.message}</span>}
            </div>
          </div>
        </GlassCard>

        {/* Card 3: Invoice Defaults */}
        <GlassCard className="p-6 md:p-8">
          <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <Receipt size={20} className="text-indigo-400"/> Invoice Defaults
          </h3>
          <p className="text-xs text-slate-500 mb-6">Pre-filled on every new invoice. You can still change them per invoice.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Tax Name</label>
              <input {...register('taxLabel')} className={inputClass} placeholder="VAT" />
            </div>
            <div>
              <label className={labelClass}>Tax Rate (%)</label>
              <input type="number" step="any" min="0" max="100" {...register('defaultTaxRate')} className={inputClass} placeholder="e.g. 7.5" />
              {errors.defaultTaxRate && <span className="text-red-400 text-xs">{errors.defaultTaxRate.message}</span>}
            </div>
            <div>
              <label className={labelClass}>Payment Terms</label>
              <select {...register('defaultDueDays')} className={clsx(inputClass, "[&>option]:bg-slate-900")}>
                <option value="">No due date</option>
                <option value="0">Due on receipt</option>
                <option value="7">Net 7 days</option>
                <option value="14">Net 14 days</option>
                <option value="30">Net 30 days</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Phone Country Code</label>
              <input {...register('defaultCountryCode')} className={inputClass} placeholder="234" inputMode="numeric" />
              {errors.defaultCountryCode && <span className="text-red-400 text-xs">{errors.defaultCountryCode.message}</span>}
              <p className="text-[11px] text-slate-500 mt-1">Used for WhatsApp reminders to local numbers like 0803…</p>
            </div>
          </div>
        </GlassCard>

        {/* Card 4: Invoice Terms */}
        <GlassCard className="p-6 md:p-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText size={20} className="text-indigo-400"/>
                Invoice Footer / Terms
            </h3>

            <div>
                <label className={labelClass}>
                    Footer Message
                </label>
                <textarea
                    {...register('invoiceFooterText')}
                    rows={4}
                    className={inputClass}
                    placeholder="e.g. Payment due within 14 days. No refunds on custom orders."
                />
                <p className="text-xs text-slate-500 mt-2">
                    This text will appear at the bottom of every PDF invoice.
                </p>
            </div>
        </GlassCard>

        {/* Floating Save Button */}
        <div className="flex justify-end pt-4">
            {successMsg && <span className="text-green-400 text-sm font-medium animate-pulse mr-4 self-center">{successMsg}</span>}

            <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                Save Settings
            </button>
        </div>

      </form>

      <CatalogCard />
      <BackupCard />
    </div>
  );
}