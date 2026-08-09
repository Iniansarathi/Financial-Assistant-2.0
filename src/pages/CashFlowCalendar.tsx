import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../storage/indexeddb';
import { useAuth } from '../services/auth/authProvider';
import {
  Calendar as CalendarIcon,
  DollarSign,
  TrendingDown,
  Clock,
  CalendarDays
} from 'lucide-react';

export const CashFlowCalendar: React.FC = () => {
  const { user } = useAuth();
  const currencySymbol = user?.currency === 'USD' ? '$' : '₹';

  // Live query obligations (unpaid bills and active subscriptions)
  const unpaidBills = useLiveQuery(() => db.bills.where('paid').equals(0).toArray()) || [];
  const subscriptions = useLiveQuery(() => db.subscriptions.toArray()) || [];

  // Generate calendar days for the current month
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-11

  const startOfMonth = new Date(currentYear, currentMonth, 1);
  const endOfMonth = new Date(currentYear, currentMonth + 1, 0);

  const totalDays = endOfMonth.getDate();
  const startDayOfWeek = startOfMonth.getDay(); // 0 = Sunday, etc.

  // Calendar dates representation: pre-fill trailing dates from previous month
  const daysGrid: Date[] = [];
  const prevMonthEnd = new Date(currentYear, currentMonth, 0).getDate();

  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    daysGrid.push(new Date(currentYear, currentMonth - 1, prevMonthEnd - i));
  }

  // Current month dates
  for (let i = 1; i <= totalDays; i++) {
    daysGrid.push(new Date(currentYear, currentMonth, i));
  }

  // Post-fill next month dates to complete 35-day or 42-day standard layout
  const gridLength = daysGrid.length > 35 ? 42 : 35;
  const remainingCells = gridLength - daysGrid.length;
  for (let i = 1; i <= remainingCells; i++) {
    daysGrid.push(new Date(currentYear, currentMonth + 1, i));
  }

  // Salary Day matching configuration
  const salaryDay = user?.salaryDate || 1;

  // Retrieve matching obligations due on a specific calendar day
  const getObligationsForDay = (dateObj: Date) => {
    const dayVal = dateObj.getDate();
    const isCurrentMonthScope = dateObj.getMonth() === currentMonth;

    const billsDue = isCurrentMonthScope
      ? unpaidBills.filter((b) => {
          const d = new Date(b.dueDate);
          return d.getDate() === dayVal && d.getMonth() === dateObj.getMonth();
        })
      : [];

    const subsDue = subscriptions.filter((s) => {
      const d = new Date(s.renewalDate);
      return d.getDate() === dayVal;
    });

    const isPayday = dayVal === salaryDay && isCurrentMonthScope;

    return {
      billsDue,
      subsDue,
      isPayday,
      totalDue: billsDue.reduce((sum, b) => sum + b.amount, 0) + subsDue.reduce((sum, s) => sum + s.amount, 0)
    };
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto text-left">
      {/* Header */}
      <div>
        <h1 className="text-heading font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <CalendarIcon className="w-8 h-8 text-blue-500" />
          Cashflow Calendar
        </h1>
        <p className="text-body text-slate-500 dark:text-gray-400">
          Visual cycle planning mapping salary payday milestones against recurring obligations and monthly bills.
        </p>
      </div>

      {/* Main Grid Card Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* The Calendar Grid Card */}
        <div className="glass-card p-6 rounded-3xl border-slate-200 dark:border-white/5 lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-title font-extrabold text-slate-900 dark:text-white">
              {monthNames[currentMonth]} {currentYear}
            </h3>
            <span className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" /> monthly view
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-micro font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {daysGrid.map((dateObj, idx) => {
              const isToday =
                dateObj.getDate() === today.getDate() &&
                dateObj.getMonth() === today.getMonth() &&
                dateObj.getFullYear() === today.getFullYear();
              
              const isCurrentMonth = dateObj.getMonth() === currentMonth;
              const { billsDue, subsDue, isPayday, totalDue } = getObligationsForDay(dateObj);

              return (
                <div
                  key={idx}
                  className={`min-h-[70px] sm:min-h-[85px] p-2 rounded-2xl border transition-all relative flex flex-col justify-between text-left group ${
                    isToday
                      ? 'bg-blue-600/10 border-blue-500/30'
                      : isCurrentMonth
                      ? 'bg-slate-50 dark:bg-white/2 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'
                      : 'bg-transparent border-transparent text-gray-500 opacity-30'
                  }`}
                >
                  {/* Day Number */}
                  <div className="flex justify-between items-center">
                    <span className={`text-[11px] font-bold ${isToday ? 'text-blue-500' : 'text-slate-700 dark:text-gray-300'}`}>
                      {dateObj.getDate()}
                    </span>
                    {isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Today" />
                    )}
                  </div>

                  {/* Indicators / Payments */}
                  <div className="space-y-1">
                    {isPayday && (
                      <div className="flex items-center gap-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-extrabold text-[9px] px-1 py-0.5 rounded-md w-fit">
                        <DollarSign className="w-2.5 h-2.5 shrink-0" /> Payday
                      </div>
                    )}

                    {totalDue > 0 && (
                      <div className="flex flex-col gap-0.5">
                        {billsDue.length > 0 && (
                          <div className="text-[8px] sm:text-[9px] bg-red-500/10 border border-red-500/20 text-red-500 font-bold px-1 py-0.5 rounded-md w-full truncate" title={`${billsDue.length} bill(s) due`}>
                            {billsDue.length} Bill{billsDue.length > 1 ? 's' : ''}
                          </div>
                        )}
                        {subsDue.length > 0 && (
                          <div className="text-[8px] sm:text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold px-1 py-0.5 rounded-md w-full truncate" title={`${subsDue.length} renewal(s)`}>
                            {subsDue.length} Sub{subsDue.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tooltip detail on hover */}
                  {(billsDue.length > 0 || subsDue.length > 0 || isPayday) && (
                    <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 rounded-xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 shadow-2xl text-left z-50 text-[10px] space-y-1.5">
                      <p className="font-bold text-slate-800 dark:text-white border-b border-white/5 pb-1">
                        {dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </p>
                      {isPayday && <p className="text-emerald-500 font-bold">• Payday cycle baseline</p>}
                      {billsDue.map(b => (
                        <p key={b.id} className="text-red-400 truncate font-medium">
                          • Bill: {b.title} ({currencySymbol}{b.amount})
                        </p>
                      ))}
                      {subsDue.map(s => (
                        <p key={s.id} className="text-indigo-400 truncate font-medium">
                          • Sub: {s.name} ({currencySymbol}{s.amount})
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Obligations Summary Column */}
        <div className="space-y-6">
          {/* Payday KPI Panel */}
          <div className="glass-card p-6 rounded-3xl border-slate-200 dark:border-white/5 bg-gradient-to-b from-blue-500/5 to-transparent space-y-4">
            <h4 className="text-caption font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-400" /> Payday Cycle
            </h4>
            
            <div className="flex justify-between items-center bg-white/2 p-3 rounded-2xl border border-white/5">
              <div>
                <span className="text-micro text-gray-500 font-semibold block uppercase">Salary Day</span>
                <span className="text-caption font-extrabold text-slate-800 dark:text-white">Day {salaryDay} of Month</span>
              </div>
              <span className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold">
                <DollarSign className="w-5 h-5" />
              </span>
            </div>
            
            <div className="text-[11px] text-slate-500 dark:text-gray-400 leading-normal">
              Safe-to-Spend models compute baseline budgets centered on your configured Payday Cycle date. Add unpaid monthly bills to map cash flows dynamically.
            </div>
          </div>

          {/* Obligations Lists */}
          <div className="glass-card p-6 rounded-3xl border-slate-200 dark:border-white/5 space-y-4">
            <h4 className="text-caption font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-red-400" /> Monthly Obligations
            </h4>

            {unpaidBills.length === 0 && subscriptions.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-micro">
                No obligations registered for this month.
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {/* Bills */}
                {unpaidBills.map((bill) => (
                  <div key={bill.id} className="flex justify-between items-center p-3 rounded-2xl bg-red-500/5 border border-red-500/10">
                    <div>
                      <p className="text-caption font-bold text-slate-900 dark:text-white leading-tight">{bill.title}</p>
                      <span className="text-[9px] text-gray-500">Due Date: {new Date(bill.dueDate).getDate()}th</span>
                    </div>
                    <span className="text-caption font-extrabold text-red-500">
                      {currencySymbol}{bill.amount.toLocaleString()}
                    </span>
                  </div>
                ))}

                {/* Subscriptions */}
                {subscriptions.map((sub) => (
                  <div key={sub.id} className="flex justify-between items-center p-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                    <div>
                      <p className="text-caption font-bold text-slate-900 dark:text-white leading-tight">{sub.name}</p>
                      <span className="text-[9px] text-gray-500">Cycle Date: {new Date(sub.renewalDate).getDate()}th ({sub.cycle})</span>
                    </div>
                    <span className="text-caption font-extrabold text-indigo-400">
                      {currencySymbol}{sub.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
