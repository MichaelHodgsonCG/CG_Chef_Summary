import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { applyPlAdjustment } from '../lib/plAdjustments';
import { DollarSign, Save, AlertCircle, X } from 'lucide-react';

type Location = {
  id: string;
  name: string;
};

type WeekData = {
  upload_id: string;
  week_ending_date: string;
  location_name: string;
  kitchen_labour_actual: number;
  line_item_id: string;
};

export function LabourAdjustments() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [weekData, setWeekData] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingWeek, setEditingWeek] = useState<string | null>(null);
  const [adjustmentValue, setAdjustmentValue] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      loadWeekData();
    }
  }, [selectedLocation]);

  const loadLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('id, name')
      .order('name');

    if (data) {
      setLocations(data);
    }
  };

  const loadWeekData = async () => {
    if (!selectedLocation) return;

    setLoading(true);
    const { data } = await supabase
      .from('weekly_summary_pl_line_items')
      .select(`
        id,
        upload_id,
        current_actual,
        pl_uploads:weekly_summary_pl_uploads!inner(
          week_ending_date,
          location_id,
          locations!inner(name)
        )
      `)
      .eq('line_item_name', 'Kitchen Labour')
      .eq('pl_uploads.location_id', selectedLocation)
      .order('pl_uploads(week_ending_date)', { ascending: false });

    if (data) {
      const formatted = data.map((item: any) => ({
        upload_id: item.upload_id,
        week_ending_date: item.pl_uploads.week_ending_date,
        location_name: item.pl_uploads.locations.name,
        kitchen_labour_actual: item.current_actual || 0,
        line_item_id: item.id
      }));
      setWeekData(formatted);
    }

    setLoading(false);
  };

  const startEditing = (weekEndingDate: string, currentValue: number) => {
    setEditingWeek(weekEndingDate);
    setAdjustmentValue(currentValue.toString());
    setMessage(null);
  };

  const cancelEditing = () => {
    setEditingWeek(null);
    setAdjustmentValue('');
  };

  const saveAdjustment = async (lineItemId: string) => {
    const newValue = parseFloat(adjustmentValue);
    if (isNaN(newValue)) {
      setMessage({ type: 'error', text: 'Please enter a valid number' });
      return;
    }

    setLoading(true);

    const { error } = await applyPlAdjustment({
      lineItemId,
      locationId: selectedLocation,
      salesLineItemName: 'Food Sales',
      newValue,
    });

    if (error) {
      setMessage({ type: 'error', text: `Error updating: ${error}` });
      setLoading(false);
      return;
    }

    setMessage({ type: 'success', text: 'Labour value updated; QTD/YTD figures and saved chef summaries refreshed' });
    setEditingWeek(null);
    setAdjustmentValue('');
    await loadWeekData();
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">BOH Labour Adjustments</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manually adjust kitchen labour values. The week's QTD/YTD figures and saved chef summaries update automatically.
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">{message.text}</div>
          <button
            onClick={() => setMessage(null)}
            className="text-current hover:opacity-70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Location
          </label>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Choose a location...</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>

        {selectedLocation && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Week Ending
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kitchen Labour
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : weekData.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                      No data found for this location
                    </td>
                  </tr>
                ) : (
                  weekData.map((week) => (
                    <tr key={week.week_ending_date} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(week.week_ending_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingWeek === week.week_ending_date ? (
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-gray-400" />
                            <input
                              type="number"
                              value={adjustmentValue}
                              onChange={(e) => setAdjustmentValue(e.target.value)}
                              className="w-32 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(week.kitchen_labour_actual)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {editingWeek === week.week_ending_date ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => saveAdjustment(week.line_item_id)}
                              disabled={loading}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-cg-accent text-white rounded hover:bg-cg-accentHover disabled:opacity-50"
                            >
                              <Save className="w-4 h-4" />
                              Save
                            </button>
                            <button
                              onClick={cancelEditing}
                              disabled={loading}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditing(week.week_ending_date, week.kitchen_labour_actual)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
