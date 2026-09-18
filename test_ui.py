import customtkinter as ctk

app = ctk.CTk()
app.geometry('800x200')

device_list_frame = ctk.CTkFrame(app)
device_list_frame.pack(fill='both', expand=True, padx=10, pady=10)

dev_data = {'online': True, 'sim1_name': '01004086192', 'sim2_name': '01959166796', 'device_id': '5caf3715', 'custom_name': 'Infinix X663', 'is_active': True}

row = ctk.CTkFrame(device_list_frame, fg_color='#1a1a2e', corner_radius=6, height=34, border_width=1, border_color='#233554')
row.pack(fill='x', pady=2, padx=2)
row.pack_propagate(False)

is_online = dev_data.get('online', False)
status_icon = '🟢' if is_online else '⚪'
color = '#059669' if is_online else '#495670'

sims = []
if dev_data.get('sim1_name'): sims.append(dev_data['sim1_name'])
if dev_data.get('sim2_name'): sims.append(dev_data['sim2_name'])
sim_text = ' | '.join(sims) if sims else 'No SIM set'

dev_id = dev_data.get('device_id')
dev_name = dev_data.get('custom_name', dev_data.get('device_name', 'Device'))
is_active = dev_data.get('is_active', True)

name_label = ctk.CTkLabel(
    row, text=f'  {status_icon}  {dev_name}',
    font=ctk.CTkFont(size=12, weight='bold'),
    text_color=color,
    height=18
)
name_label.pack(side='left', padx=10)

switch = ctk.CTkSwitch(
    row, text='', width=38, height=18, switch_width=32, switch_height=16,
    command=lambda: print('toggle')
)
if is_active: switch.select()
switch.pack(side='right', padx=(5, 10))

ctk.CTkButton(
    row, text='✏️ Edit Name', width=52, height=20,
    font=ctk.CTkFont(size=10, weight='bold'), fg_color='#233554', hover_color='#2a4365',
    command=lambda: print('rename')
).pack(side='right', padx=5)

sim_label = ctk.CTkLabel(
    row, text=f'SIMs: {sim_text}  ',
    font=ctk.CTkFont(size=13, weight='bold'),
    text_color='#ccd6f6',
    height=18
)
sim_label.pack(side='right', padx=10)

app.after(3000, app.destroy)
app.mainloop()
