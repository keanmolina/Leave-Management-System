import React, { useState, useEffect, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import api from '../services/api';

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [leaves, setLeaves] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [deptFilter, setDeptFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const res = await api.get('/leaves/calendar');
        setLeaves(res.data.leaves || []);
        setHolidays(res.data.holidays || []);
        setDepartments(res.data.departments || []);
        setLeaveTypes(res.data.leaveTypes || []);
      } catch (err) {
        console.error('Error fetching calendar', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCalendar();
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const cleanDateStr = (raw) => {
    if (!raw) return '';
    return typeof raw === 'string' ? raw.split('T')[0] : format(new Date(raw), 'yyyy-MM-dd');
  };

  const filteredLeaves = useMemo(() => {
    return leaves.filter((l) => {
      const matchDept =
        deptFilter === 'ALL' || String(l.department_id) === String(deptFilter);
      const matchType =
        typeFilter === 'ALL' || String(l.leave_type_id) === String(typeFilter);
      return matchDept && matchType;
    });
  }, [leaves, deptFilter, typeFilter]);

  if (loading) {
    return <div className="text-slate-500 text-sm">Loading attendance calendar...</div>;
  }

  return (
    <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">University Absence Calendar</h2>
          <p className="text-xs text-slate-500">Approved leaves and statutory non-working holidays.</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
          >
            ‹ Prev
          </button>
          <span className="text-sm font-bold text-slate-800 px-2">
            {format(currentDate, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
          >
            Next ›
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
        <span className="text-slate-600 font-semibold">Filter By:</span>

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="bg-white border border-slate-300 text-slate-700 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-[#800000] shadow-xs"
        >
          <option value="ALL">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-white border border-slate-300 text-slate-700 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-[#800000] shadow-xs"
        >
          <option value="ALL">All Categories</option>
          {leaveTypes.map((lt) => (
            <option key={lt.id} value={lt.id}>
              {lt.name}
            </option>
          ))}
        </select>

        {(deptFilter !== 'ALL' || typeFilter !== 'ALL') && (
          <button
            onClick={() => {
              setDeptFilter('ALL');
              setTypeFilter('ALL');
            }}
            className="text-[#800000] hover:text-[#660000] underline font-semibold ml-auto cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
        <div>Sun</div>
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isCurrentMonth = isSameMonth(day, monthStart);

          const dayHolidays = holidays.filter((h) => cleanDateStr(h.holiday_date) === dateStr);
          const dayLeaves = filteredLeaves.filter((l) => {
            const start = cleanDateStr(l.start_date);
            const end = cleanDateStr(l.end_date);
            return dateStr >= start && dateStr <= end;
          });

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[92px] p-2 border rounded-xl flex flex-col justify-between transition ${
                isCurrentMonth
                  ? 'bg-white border-slate-200 text-slate-800'
                  : 'bg-slate-50/70 border-slate-100 text-slate-400'
              }`}
            >
              <div className="flex justify-between items-center text-xs">
                <span className={`font-semibold ${isSameDay(day, new Date()) ? 'w-5 h-5 flex items-center justify-center rounded-full bg-[#800000] text-white font-bold' : ''}`}>
                  {format(day, 'd')}
                </span>
              </div>

              <div className="space-y-1 overflow-hidden mt-1">
                {dayHolidays.map((h) => (
                  <div
                    key={h.id}
                    title={h.name}
                    className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded truncate font-medium"
                  >
                    🏛️ {h.name}
                  </div>
                ))}
                {dayLeaves.map((l) => (
                  <div
                    key={l.id}
                    title={`${l.first_name} ${l.last_name} (${l.leave_type} - ${l.department_name || 'N/A'})`}
                    className="text-[10px] bg-red-50 text-[#800000] border border-red-200 px-1.5 py-0.5 rounded truncate font-semibold"
                  >
                    👤 {l.first_name}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}