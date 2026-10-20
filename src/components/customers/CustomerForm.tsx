import { FieldError } from '../ui/FieldError';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '../../db';
import { deleteCustomer } from '../../db/mutations';
import { failed } from '../../lib/messages';
import { Card } from '../ui/Card';
import { FIELD_CLASS } from '../ui/styles';
import { useDialogs } from '../ui/dialogContext';
import { Save, X, Globe, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Customer } from '../../types';

// Schema with conditional logic handled by Zod
const customerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(10, "Valid phone number required"),
  email: z.string().email().optional().or(z.literal('')),
  isInternational: z.boolean(),
  // Address fields (We make them optional in schema but enforce via UI if checked)
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface Props {
  onComplete: () => void;
  onCancel: () => void;
  initialData?: Customer;
}

export function CustomerForm({ onComplete, onCancel, initialData }: Props) {
  const { confirm, alert } = useDialogs();
  const { register, handleSubmit, control, formState: { errors } } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          phone: initialData.phone,
          email: initialData.email ?? '',
          address: initialData.address ?? '',
          city: initialData.city ?? '',
          country: initialData.country ?? '',
          // Older records never stored the toggle; infer it from the address fields
          isInternational: initialData.isInternational ?? !!(initialData.address || initialData.city || initialData.country),
        }
      : { isInternational: false }
  });

  // Watch the checkbox to toggle UI
  const isInternational = useWatch({ control, name: 'isInternational' });

  const onSubmit = async (data: CustomerFormValues) => {
    try {
      if (initialData?.id) {
        await db.customers.update(initialData.id, data);
      } else {
        await db.customers.add({ ...data, id: crypto.randomUUID(), createdAt: new Date() });
      }
      onComplete();
    } catch (err) {
      console.error(err);
      await alert(failed('save this client'));
    }
  };

  const handleDelete = async () => {
    if (!initialData?.id) return;
    const invoiceCount = await db.invoices.where('customerId').equals(initialData.id).count();
    if (invoiceCount > 0) {
      await alert(`${initialData.name} has ${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'} or quote${invoiceCount === 1 ? '' : 's'}. Delete those first to keep your records consistent.`);
      return;
    }
    const sure = await confirm({
      title: 'Delete this client?',
      message: `${initialData.name} will be deleted. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!sure) return;
    try {
      // Re-checked inside the delete itself, in case a document was added since the check above
      if (await deleteCustomer(initialData.id) > 0) {
        await alert(`${initialData.name} now has invoices or quotes. Delete those first to keep your records consistent.`);
        return;
      }
      onComplete();
    } catch (err) {
      console.error(err);
      await alert(failed('delete this client'));
    }
  };

  const inputClass = FIELD_CLASS;
  const labelClass = "block text-xs font-medium text-muted mb-1 tracking-wider";

  return (
    <Card className="max-w-xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-ink">
          {initialData ? 'Edit Customer' : 'New Customer'}
        </h1>
        <button onClick={onCancel} className="text-muted hover:text-ink" aria-label="Close">
          <X size={24} />
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {/* Core Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="cust-name">Customer Name</label>
            <input id="cust-name" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'cust-name-error' : undefined} {...register('name')} className={inputClass} placeholder="e.g. Mrs. Adebayo" />
            <FieldError id="cust-name-error" message={errors.name?.message} />
          </div>
          <div>
            <label className={labelClass} htmlFor="cust-phone">Phone</label>
            <input id="cust-phone" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'cust-phone-error' : undefined} {...register('phone')} className={inputClass} placeholder="080..." />
            <FieldError id="cust-phone-error" message={errors.phone?.message} />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="cust-email">Email (Optional)</label>
          <input id="cust-email" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'cust-email-error' : undefined} {...register('email')} className={inputClass} placeholder="client@example.com" />
          <FieldError id="cust-email-error" message={errors.email?.message} />
        </div>

        {/* International Toggle */}
        <div className="py-2">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input type="checkbox" {...register('isInternational')} className="w-5 h-5 rounded border-line-strong bg-sunken text-primary focus:ring-primary" />
            <div className="flex items-center gap-2 text-muted group-hover:text-ink transition-colors">
              <Globe size={18} />
              <span className="font-medium">International / Shipping Required</span>
            </div>
          </label>
        </div>

        {/* Animated Address Section */}
        <AnimatePresence>
          {isInternational && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-4 border-l-2 border-line pl-4"
            >
              <div>
                <label className={labelClass} htmlFor="cust-address">Full Shipping Address</label>
                <textarea id="cust-address" {...register('address')} rows={2} className={inputClass} placeholder="Street address..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="cust-city">City</label>
                  <input id="cust-city" {...register('city')} className={inputClass} placeholder="London" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="cust-country">Country</label>
                  <input id="cust-country" {...register('country')} className={inputClass} placeholder="UK" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-4 flex justify-end gap-3">
          {initialData?.id && (
            <button type="button" onClick={handleDelete} className="mr-auto flex items-center gap-1.5 px-3 py-2 text-danger hover:text-danger text-sm">
              <Trash2 size={16} /> Delete
            </button>
          )}
          <button type="button" onClick={onCancel} className="px-4 py-2 text-muted hover:text-ink">Cancel</button>
          <button type="submit" className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-on-primary px-6 py-2 rounded-xl font-medium">
            <Save size={18} />
            Save Customer
          </button>
        </div>

      </form>
    </Card>
  );
}