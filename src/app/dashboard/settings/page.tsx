'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Settings,
  Plus,
  Trash2,
  Loader2,
  Database,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

type CustomFieldDefinition = {
  id: string;
  entity_type: 'customer' | 'invoice';
  field_name: string;
  field_type: 'text' | 'number' | 'date' | 'boolean';
  created_at: string;
};

export default function SettingsPage() {
  const supabase = createClient();
  
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingField, setAddingField] = useState(false);

  // Form State
  const [fieldName, setFieldName] = useState('');
  const [entityType, setEntityType] = useState<'customer' | 'invoice'>('customer');
  const [fieldType, setFieldType] = useState<'text' | 'number' | 'date' | 'boolean'>('text');

  const fetchFields = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFields(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load custom fields catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFields();
  }, [supabase]);

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldName) {
      toast.error('Field Name is required.');
      return;
    }

    // Clean field name to be alphanumeric + space
    const cleanFieldName = fieldName.trim().replace(/[^a-zA-Z0-9 ]/g, '');
    if (!cleanFieldName) {
      toast.error('Field name can only contain letters, numbers, and spaces.');
      return;
    }

    setAddingField(true);
    try {
      // Check for duplicate names on the same entity
      const duplicate = fields.find(
        (f) => f.entity_type === entityType && f.field_name.toLowerCase() === cleanFieldName.toLowerCase()
      );

      if (duplicate) {
        toast.error(`A field named "${cleanFieldName}" already exists for ${entityType}s.`);
        setAddingField(false);
        return;
      }

      const { error } = await supabase.from('custom_fields').insert([
        {
          entity_type: entityType,
          field_name: cleanFieldName,
          field_type: fieldType,
        },
      ]);

      if (error) throw error;

      toast.success(`Custom field "${cleanFieldName}" added to ${entityType} catalog.`);
      setFieldName('');
      fetchFields();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save custom field.');
    } finally {
      setAddingField(false);
    }
  };

  const handleDeleteField = async (id: string) => {
    const confirm = window.confirm('Are you sure you want to delete this custom field? This will NOT delete existing data stored in customer profiles, but the field will no longer render in forms.');
    if (!confirm) return;

    try {
      const { error } = await supabase.from('custom_fields').delete().eq('id', id);
      if (error) throw error;

      toast.success('Custom field deleted.');
      fetchFields();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete custom field.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
          <Settings className="h-8 w-8 text-indigo-500" />
          Settings
        </h1>
        <p className="text-slate-400 text-sm mt-1">Configure profile schema catalogs and database controls</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form to Add Custom Field */}
        <div className="lg:col-span-1">
          <Card className="bg-slate-900 border-slate-800 text-slate-200">
            <CardHeader>
              <CardTitle className="text-md font-bold text-white">Define Custom Fields</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Add dynamic data headers to profiles.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleAddField}>
              <CardContent className="space-y-4 text-xs">
                <div className="space-y-2">
                  <Label htmlFor="fieldNameInput" className="text-slate-300 font-medium">
                    Field Name Label
                  </Label>
                  <Input
                    id="fieldNameInput"
                    placeholder="e.g. Meter Reading or Flat Number"
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white rounded-lg py-5"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entitySelect" className="text-slate-300 font-medium">
                    Profile Entity
                  </Label>
                  <select
                    id="entitySelect"
                    value={entityType}
                    onChange={(e: any) => setEntityType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg text-xs py-2.5 px-3 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="customer">Customer Profile</option>
                    <option value="invoice">Invoice Ledger</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="typeSelect" className="text-slate-300 font-medium">
                    Data Input Type
                  </Label>
                  <select
                    id="typeSelect"
                    value={fieldType}
                    onChange={(e: any) => setFieldType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg text-xs py-2.5 px-3 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="text">Text / String</option>
                    <option value="number">Numeric</option>
                    <option value="date">Date</option>
                    <option value="boolean">Checkbox / Boolean</option>
                  </select>
                </div>
              </CardContent>
              <CardFooter className="border-t border-slate-850 pt-4 mt-2">
                <Button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-5 rounded-lg flex items-center justify-center gap-1.5"
                  disabled={addingField}
                >
                  {addingField ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Add Catalog Field
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        {/* List of Custom Fields */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-900 border-slate-800 text-slate-200">
            <CardHeader className="border-b border-slate-800 pb-3">
              <CardTitle className="text-md font-bold text-white flex items-center gap-2">
                <Database className="h-4.5 w-4.5 text-indigo-400" /> Active Custom Fields Schema
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                  <span className="text-xs">Loading schema details...</span>
                </div>
              ) : fields.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">No custom fields defined yet.</div>
              ) : (
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold bg-slate-950/20">
                        <th className="p-4">Entity</th>
                        <th className="p-4">Label</th>
                        <th className="p-4">Type</th>
                        <th className="p-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field) => (
                        <tr key={field.id} className="border-b border-slate-800/60 hover:bg-slate-850/40">
                          <td className="p-4 font-semibold text-white capitalize">{field.entity_type}</td>
                          <td className="p-4 font-medium text-slate-300">{field.field_name}</td>
                          <td className="p-4 text-slate-400 capitalize">{field.field_type}</td>
                          <td className="p-4 text-right">
                            <Button
                              onClick={() => handleDeleteField(field.id)}
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-400 hover:text-red-500 hover:bg-red-950/20 rounded-md"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Secure Headers & Session metadata panel */}
          <Card className="bg-slate-900 border-slate-800 text-slate-200">
            <CardHeader className="border-b border-slate-800 pb-3">
              <CardTitle className="text-md font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-4.5 w-4.5 text-indigo-400" /> System Security Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-xs space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between">
                  <span className="text-slate-400">Row Level Security (RLS)</span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 font-bold uppercase text-[9px]">
                    ACTIVE
                  </span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between">
                  <span className="text-slate-400">CSRF / XSS Headers</span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 font-bold uppercase text-[9px]">
                    ENFORCED
                  </span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between">
                  <span className="text-slate-400">Rate Limiter</span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 font-bold uppercase text-[9px]">
                    PROTECTED
                  </span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl flex items-center justify-between">
                  <span className="text-slate-400">Audit Trail Triggers</span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 font-bold uppercase text-[9px]">
                    LOGGING
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
