import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { DATE_FORMATS, DEFAULT_DATE_FORMAT } from '../../lib/dates';
import { failed } from '../../lib/messages';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '../../db';
import { GlassCard } from '../ui/GlassCard';
import { INPUT_CLASS } from '../ui/styles';
import { useDialogs } from '../ui/dialogContext';
import { Save, Upload, Loader2, FileText, Receipt } from 'lucide-react';
import { clsx } from 'clsx';
import { FieldError } from '../ui/FieldError';
import type { BusinessProfile } from '../../types';
import { DEFAULT_INVOICE_TERMS } from '../../lib/invoice';
import { DEFAULT_COUNTRY_CODE } from '../../lib/whatsapp';
import { BackupCard } from './BackupCard';
import { AppLockCard } from './AppLockCard';
import { DataSafetyCard } from './DataSafetyCard';
import { ProblemReportCard } from './ProblemReportCard';
import { AboutCard } from './AboutCard';
import { EraseDataCard } from './EraseDataCard';
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
  dateFormat: z.enum(['dmy', 'mdy', 'ymd', 'long']),
});

type ProfileFormValues = z.infer<typeof profileSchema>;


export function BusinessProfileForm({ onLock }: { onLock?: () => void }) {
  const { alert } = useDialogs();
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
      dateFormat: DEFAULT_DATE_FORMAT,
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
        setValue('dateFormat', profile.dateFormat ?? DEFAULT_DATE_FORMAT);

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
        void alert("That logo is larger than 2 MB. Please choose a smaller image.");
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
      await alert(failed('save your settings'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = INPUT_CLASS;
  const labelClass = "block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider";

  return (
    <div className="max-w-2xl mx-auto pb-20">
      <h1 className="text-2xl font-bold text-white mb-6">Business Settings</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* Card 1: Brand & Contact */}
        <GlassCard className="p-6 md:p-8">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Upload size={20} className="text-indigo-400"/> Brand Identity
            </h2>

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
                <label className={labelClass} htmlFor="biz-businessName">Business Name</label>
                <input id="biz-businessName" aria-invalid={!!errors.businessName} aria-describedby={errors.businessName ? 'biz-businessName-error' : undefined} {...register('businessName')} className={inputClass} placeholder="e.g. Acme Supplies Ltd" />
                <FieldError id="biz-businessName-error" message={errors.businessName?.message} />
            </div>
            <div>
                <label className={labelClass} htmlFor="biz-ownerName">Owner Name</label>
                <input id="biz-ownerName" {...register('ownerName')} className={inputClass} placeholder="e.g. Ronke" />
            </div>
            <div>
                <label className={labelClass} htmlFor="biz-phone">Phone</label>
                <input id="biz-phone" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'biz-phone-error' : undefined} {...register('phone')} className={inputClass} placeholder="+234..." />
                <FieldError id="biz-phone-error" message={errors.phone?.message} />
            </div>
             <div>
                <label className={labelClass} htmlFor="biz-email">Email (Optional)</label>
                <input id="biz-email" {...register('email')} className={inputClass} placeholder="hello@example.com" />
            </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className={labelClass} htmlFor="biz-brandColor">Brand Colour</label>
                <div className="flex items-center gap-3">
                  <input id="biz-brandColor" aria-invalid={!!errors.brandColor} aria-describedby={errors.brandColor ? 'biz-brandColor-error' : undefined} type="color" {...register('brandColor')} className="h-11 w-14 rounded-lg bg-transparent border border-white/10 cursor-pointer" />
                  <span className="text-xs text-slate-500">Used for your name, table headers and highlights on PDFs.</span>
                </div>
                <FieldError id="biz-brandColor-error" message={errors.brandColor?.message} />
              </div>
              <div>
                <label className={labelClass} htmlFor="biz-invoiceTemplate">PDF Template</label>
                <select id="biz-invoiceTemplate" {...register('invoiceTemplate')} className={clsx(inputClass, "[&>option]:bg-slate-900")}>
                  <option value="classic">Classic (white header)</option>
                  <option value="modern">Modern (colour header band)</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
            <label className={labelClass} htmlFor="biz-address">Office Address</label>
            <textarea id="biz-address" aria-invalid={!!errors.address} aria-describedby={errors.address ? 'biz-address-error' : undefined} {...register('address')} rows={2} className={inputClass} placeholder="Full street address..." />
            <FieldError id="biz-address-error" message={errors.address?.message} />
            </div>
        </GlassCard>

        {/* Card 2: Bank Details */}
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Save size={20} className="text-indigo-400"/> Payment Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor="biz-bankName">Bank Name</label>
              <input id="biz-bankName" aria-invalid={!!errors.bankName} aria-describedby={errors.bankName ? 'biz-bankName-error' : undefined} {...register('bankName')} className={inputClass} placeholder="e.g. GTBank" />
              <FieldError id="biz-bankName-error" message={errors.bankName?.message} />
            </div>
            <div>
              <label className={labelClass} htmlFor="biz-accountNumber">Account Number</label>
              <input id="biz-accountNumber" aria-invalid={!!errors.accountNumber} aria-describedby={errors.accountNumber ? 'biz-accountNumber-error' : undefined} {...register('accountNumber')} className={inputClass} placeholder="0123456789" />
              <FieldError id="biz-accountNumber-error" message={errors.accountNumber?.message} />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass} htmlFor="biz-accountName">Account Name</label>
              <input id="biz-accountName" aria-invalid={!!errors.accountName} aria-describedby={errors.accountName ? 'biz-accountName-error' : undefined} {...register('accountName')} className={inputClass} placeholder="Account Holder Name" />
              <FieldError id="biz-accountName-error" message={errors.accountName?.message} />
            </div>
          </div>
        </GlassCard>

        {/* Card 3: Invoice Defaults */}
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <Receipt size={20} className="text-indigo-400"/> Invoice Defaults
          </h2>
          <p className="text-xs text-slate-500 mb-6">Pre-filled on every new invoice. You can still change them per invoice.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass} htmlFor="biz-taxLabel">Tax Name</label>
              <input id="biz-taxLabel" {...register('taxLabel')} className={inputClass} placeholder="VAT" />
            </div>
            <div>
              <label className={labelClass} htmlFor="biz-defaultTaxRate">Tax Rate (%)</label>
              <input id="biz-defaultTaxRate" aria-invalid={!!errors.defaultTaxRate} aria-describedby={errors.defaultTaxRate ? 'biz-defaultTaxRate-error' : undefined} type="number" step="any" min="0" max="100" {...register('defaultTaxRate')} className={inputClass} placeholder="e.g. 7.5" />
              <FieldError id="biz-defaultTaxRate-error" message={errors.defaultTaxRate?.message} />
            </div>
            <div>
              <label className={labelClass} htmlFor="biz-defaultDueDays">Payment Terms</label>
              <select id="biz-defaultDueDays" {...register('defaultDueDays')} className={clsx(inputClass, "[&>option]:bg-slate-900")}>
                <option value="">No due date</option>
                <option value="0">Due on receipt</option>
                <option value="7">Net 7 days</option>
                <option value="14">Net 14 days</option>
                <option value="30">Net 30 days</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="biz-defaultCountryCode">Phone Country Code</label>
              <input id="biz-defaultCountryCode" aria-invalid={!!errors.defaultCountryCode} aria-describedby={errors.defaultCountryCode ? 'biz-defaultCountryCode-error' : undefined} {...register('defaultCountryCode')} className={inputClass} placeholder="234" inputMode="numeric" />
              <FieldError id="biz-defaultCountryCode-error" message={errors.defaultCountryCode?.message} />
              <p className="text-[11px] text-slate-500 mt-1">Used for WhatsApp reminders to local numbers like 0803…</p>
            </div>
            <div>
              <label className={labelClass} htmlFor="biz-dateFormat">Date Format</label>
              <select id="biz-dateFormat" {...register('dateFormat')} className={clsx(inputClass, "[&>option]:bg-slate-900")}>
                {DATE_FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">Used in the app, PDFs and receipts on every device.</p>
            </div>
          </div>
        </GlassCard>

        {/* Card 4: Invoice Terms */}
        <GlassCard className="p-6 md:p-8">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText size={20} className="text-indigo-400"/>
                Invoice Footer / Terms
            </h2>

            <div>
                <label className={labelClass} htmlFor="biz-invoiceFooterText">
                    Footer Message
                </label>
                <textarea id="biz-invoiceFooterText"
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
            {successMsg && <span role="status" className="text-green-400 text-sm font-medium animate-pulse mr-4 self-center">{successMsg}</span>}

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
      <AppLockCard onLockNow={onLock} />
      <DataSafetyCard />
      <ProblemReportCard />
      <AboutCard />
      <EraseDataCard />
    </div>
  );
}