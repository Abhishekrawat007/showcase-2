#!/usr/bin/env python3
"""
Flexible SEO Meta Tags Bot
- Option 1: Provide your own meta tags
- Option 2: Auto-generate meta tags
"""

import os
import re
from pathlib import Path

# Category templates (same as before)
TEMPLATES = {
    '1': {
        'name': '🍬 Sweets/Mithai Store',
        'title': '{name} – Fresh Mithai & Sweets Online',
        'desc': 'Order fresh sweets, mithai, and desserts online from {name}. Premium quality sweets in {location}. Free delivery on orders over ₹199.',
        'keywords': 'sweets {location}, mithai online, {name}, gulab jamun, rasgulla, kaju katli, online sweets delivery {location}, fresh sweets'
    },
    '2': {
        'name': '👗 Fashion/Clothing Store',
        'title': '{name} – Trendy Affordable Clothing Online',
        'desc': 'Shop latest fashion trends online at {name}. Affordable clothing, accessories & more in {location}. Free delivery over ₹199.',
        'keywords': 'fashion {location}, online clothing, affordable fashion, {name}, trendy clothes {location}, fashion store'
    },
    '3': {
        'name': '📱 Electronics Store',
        'title': '{name} – Electronics & Gadgets Online',
        'desc': 'Buy electronics, mobile accessories, and gadgets online from {name}. Best prices in {location}. Free delivery over ₹199.',
        'keywords': 'electronics {location}, gadgets online, {name}, mobile accessories, online electronics store {location}'
    },
    '4': {
        'name': '🛒 Grocery Store',
        'title': '{name} – Online Grocery Delivery',
        'desc': 'Order fresh groceries, vegetables, and daily essentials online from {name}. Fast delivery in {location}. Free delivery over ₹199.',
        'keywords': 'grocery {location}, online grocery, {name}, vegetables online, daily essentials {location}, grocery delivery'
    },
    '5': {
        'name': '💍 Jewelry Store',
        'title': '{name} – Jewelry & Ornaments Online',
        'desc': 'Shop beautiful jewelry, gold, silver, and artificial ornaments online from {name} in {location}. Free delivery over ₹199.',
        'keywords': 'jewelry {location}, online jewelry, {name}, gold jewelry, artificial jewelry {location}, ornaments online'
    },
    '6': {
        'name': '🍽️ Restaurant/Cafe',
        'title': '{name} – Best Restaurant in {location}',
        'desc': 'Experience delicious food at {name}, the best restaurant in {location}. Dine-in, takeaway, and home delivery available.',
        'keywords': 'restaurant {location}, {name}, best food {location}, home delivery, dine-in {location}, cafe'
    },
    '7': {
        'name': '🏨 Hotel/Resort',
        'title': '{name} – Hotel & Resort in {location}',
        'desc': 'Book your stay at {name}, a premium hotel in {location}. Comfortable rooms, great service, and excellent amenities.',
        'keywords': 'hotel {location}, {name}, resort {location}, accommodation, rooms {location}, hotel booking'
    },
    '8': {
        'name': '🏥 Hospital/Clinic',
        'title': '{name} – Multispecialty Hospital in {location}',
        'desc': '{name} is a leading hospital in {location} offering expert medical care, advanced facilities, and 24/7 emergency services.',
        'keywords': 'hospital {location}, {name}, medical care {location}, doctors, emergency services {location}, healthcare'
    },
    '9': {
        'name': '👨‍⚕️ Doctor Website',
        'title': 'Dr. {name} – {location} | Book Appointment Online',
        'desc': 'Consult Dr. {name}, experienced doctor in {location}. Book appointment online for expert medical consultation and treatment.',
        'keywords': 'doctor {location}, Dr. {name}, medical consultation {location}, book appointment, specialist {location}'
    },
    '10': {
        'name': '🏫 School/College',
        'title': '{name} – Best School in {location}',
        'desc': '{name} provides quality education with experienced teachers in {location}. Admission open for new session.',
        'keywords': 'school {location}, {name}, education {location}, admission, best school {location}, quality education'
    },
    '11': {
        'name': '📚 Coaching Institute',
        'title': '{name} – Coaching Classes in {location}',
        'desc': 'Join {name} for expert coaching in {location}. Experienced faculty, proven results, and comprehensive study material.',
        'keywords': 'coaching {location}, {name}, classes {location}, tuition, exam preparation {location}, coaching institute'
    },
    '12': {
        'name': '🏠 Real Estate',
        'title': '{name} – Property Dealer in {location}',
        'desc': 'Find your dream home with {name}, trusted property dealer in {location}. Residential & commercial properties available.',
        'keywords': 'property {location}, {name}, real estate {location}, buy property, sell property {location}, homes for sale'
    },
    '13': {
        'name': '⚡ Electrician Service',
        'title': '{name} – Electrician Services in {location}',
        'desc': 'Professional electrician services by {name} in {location}. Electrical repair, installation, and maintenance. Call now!',
        'keywords': 'electrician {location}, {name}, electrical services {location}, wiring, repair {location}, electrical work'
    },
    '14': {
        'name': '🔧 Plumber Service',
        'title': '{name} – Plumber Services in {location}',
        'desc': 'Expert plumber services by {name} in {location}. Plumbing repair, installation, and emergency services. Quick response!',
        'keywords': 'plumber {location}, {name}, plumbing services {location}, pipe repair, emergency plumber {location}'
    },
    '15': {
        'name': '🧹 Cleaning Service',
        'title': '{name} – Professional Cleaning Services in {location}',
        'desc': 'Get professional cleaning services from {name} in {location}. Home, office, and deep cleaning solutions.',
        'keywords': 'cleaning service {location}, {name}, professional cleaning {location}, home cleaning, office cleaning {location}'
    },
    '16': {
        'name': '💻 IT/Web Agency',
        'title': '{name} – Web Development & IT Services in {location}',
        'desc': '{name} offers web development, app development, and IT solutions in {location}. Professional digital services for your business.',
        'keywords': 'web development {location}, {name}, IT services {location}, app development, website design {location}, digital agency'
    },
    '17': {
        'name': '⚖️ Law Firm',
        'title': '{name} – Law Firm & Legal Services in {location}',
        'desc': '{name} provides expert legal consultation and services in {location}. Experienced lawyers for all your legal needs.',
        'keywords': 'lawyer {location}, {name}, legal services {location}, law firm, advocate {location}, legal consultation'
    },
    '18': {
        'name': '💼 CA/Finance Firm',
        'title': '{name} – Chartered Accountant in {location}',
        'desc': '{name} offers CA services, tax filing, audit, and financial consultation in {location}. Expert accounting solutions.',
        'keywords': 'chartered accountant {location}, {name}, CA services {location}, tax filing, audit {location}, GST'
    },
    '19': {
        'name': '👨‍💻 Developer Portfolio',
        'title': '{name} – Web Developer Portfolio | {location}',
        'desc': 'Professional web developer {name} from {location}. Specialized in modern web development, React, Node.js, and full-stack solutions.',
        'keywords': 'web developer {location}, {name}, portfolio, React developer, full-stack developer {location}, freelance developer'
    },
    '20': {
        'name': '🎨 Designer Portfolio',
        'title': '{name} – UI/UX Designer Portfolio | {location}',
        'desc': 'Creative UI/UX designer {name} from {location}. Expert in user interface design, user experience, and product design.',
        'keywords': 'UI UX designer {location}, {name}, portfolio, graphic designer, product designer {location}, freelance designer'
    }
}

def show_categories():
    """Display all available categories"""
    print("\n" + "="*60)
    print("📋 AVAILABLE CATEGORIES")
    print("="*60)
    for key, template in TEMPLATES.items():
        print(f"{key:>3}. {template['name']}")
    print("="*60 + "\n")

def get_input(prompt, required=True):
    """Get user input with validation"""
    while True:
        value = input(prompt).strip()
        if value or not required:
            return value
        print("❌ This field is required!")

def yes_no(prompt):
    """Get yes/no input"""
    while True:
        response = input(prompt).strip().lower()
        if response in ['yes', 'y']:
            return True
        elif response in ['no', 'n']:
            return False
        print("❌ Please answer 'yes' or 'no'")

def update_meta_tags(html_content, title, desc, keywords, ga_id=None):
    """Update meta tags in HTML content"""
    
    # Escape special characters for HTML
    def escape_html(text):
        return (text.replace('&', '&amp;')
                    .replace('<', '&lt;')
                    .replace('>', '&gt;')
                    .replace('"', '&quot;')
                    .replace("'", '&#39;'))
    
    safe_desc = escape_html(desc)
    safe_keywords = escape_html(keywords)
    
    # Remove existing title
    html_content = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', html_content, flags=re.IGNORECASE)
    
    # Remove existing description
    html_content = re.sub(r'<meta\s+name=["\']description["\']\s+content=["\'][^"\']*["\']\s*/?>', '', html_content, flags=re.IGNORECASE)
    
    # Remove existing keywords
    html_content = re.sub(r'<meta\s+name=["\']keywords["\']\s+content=["\'][^"\']*["\']\s*/?>', '', html_content, flags=re.IGNORECASE)
    
    # Remove existing Google Analytics
    html_content = re.sub(r'<!--\s*Google tag.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    html_content = re.sub(r'<script[^>]*googletagmanager[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    html_content = re.sub(r'<script[^>]*gtag[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    
    # Find </title> and insert new meta tags
    title_match = re.search(r'</title>', html_content, re.IGNORECASE)
    if title_match:
        insert_point = title_match.end()
        new_meta = f'\n  <meta name="description" content="{safe_desc}">'
        new_meta += f'\n  <meta name="keywords" content="{safe_keywords}">'
        
        if ga_id:
            new_meta += '\n\n  <!-- Google Analytics -->'
            new_meta += f'\n  <script async src="https://www.googletagmanager.com/gtag/js?id={ga_id}"></script>'
            new_meta += '\n  <script>'
            new_meta += '\n    window.dataLayer = window.dataLayer || [];'
            new_meta += '\n    function gtag(){dataLayer.push(arguments);}'
            new_meta += "\n    gtag('js', new Date());"
            new_meta += f"\n    gtag('config', '{ga_id}');"
            new_meta += '\n  </script>'
        
        html_content = html_content[:insert_point] + new_meta + html_content[insert_point:]
    
    return html_content

def process_html_files(directory, title, desc, keywords, ga_id=None):
    """Process all HTML files in directory"""
    html_files = list(Path(directory).glob('*.html'))
    
    if not html_files:
        print("\n❌ No HTML files found in current directory!")
        return
    
    print(f"\n📁 Found {len(html_files)} HTML file(s):\n")
    for f in html_files:
        print(f"   • {f.name}")
    
    print("\n" + "="*60)
    
    if not yes_no("Update all these files? (yes/no): "):
        print("\n❌ Cancelled!")
        return
    
    print("\n🚀 Processing files...\n")
    
    updated = 0
    for html_file in html_files:
        try:
            # Read file
            with open(html_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Update meta tags
            new_content = update_meta_tags(content, title, desc, keywords, ga_id)
            
            # Write back
            with open(html_file, 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            print(f"✅ Updated: {html_file.name}")
            updated += 1
            
        except Exception as e:
            print(f"❌ Error updating {html_file.name}: {str(e)}")
    
    print("\n" + "="*60)
    print(f"✅ Successfully updated {updated}/{len(html_files)} files!")
    print("="*60 + "\n")

def main():
    """Main function"""
    print("\n" + "="*60)
    print("🤖 FLEXIBLE SEO META TAGS BOT")
    print("="*60)
    
    # Ask if user has meta tags ready
    print("\n📌 Do you already have your meta tags ready?")
    has_meta = yes_no("(yes/no): ")
    
    title = None
    desc = None
    keywords = None
    
    if has_meta:
        # Manual mode - user provides meta tags
        print("\n✍️  MANUAL MODE - Provide your meta tags\n")
        title = get_input("Title tag: ")
        desc = get_input("Description: ")
        keywords = get_input("Keywords: ")
    else:
        # Auto-generate mode
        print("\n🤖 AUTO-GENERATE MODE\n")
        show_categories()
        
        category = get_input("Select category number: ")
        
        if category not in TEMPLATES:
            print("\n❌ Invalid category!")
            return
        
        template = TEMPLATES[category]
        print(f"\n✅ Selected: {template['name']}\n")
        
        site_name = get_input("Site/Business Name: ")
        location = get_input("Location (City): ")
        
        # Generate meta tags
        title = template['title'].replace('{name}', site_name).replace('{location}', location)
        desc = template['desc'].replace('{name}', site_name).replace('{location}', location)
        keywords = template['keywords'].replace('{name}', site_name).replace('{location}', location)
    
    # Ask about Google Analytics
    print("\n📊 Do you have Google Analytics?")
    has_ga = yes_no("(yes/no): ")
    
    ga_id = None
    if has_ga:
        ga_id = get_input("\nGoogle Analytics ID (e.g., G-XXXXXXXXX): ")
    
    # Show preview
    print("\n" + "="*60)
    print("📋 PREVIEW")
    print("="*60)
    print(f"\nTitle:       {title}")
    print(f"\nDescription: {desc}")
    print(f"\nKeywords:    {keywords}")
    if ga_id:
        print(f"\nGA ID:       {ga_id}")
    print("\n" + "="*60)
    
    if not yes_no("\nLooks good? (yes/no): "):
        print("\n❌ Cancelled!")
        return
    
    # Process files
    current_dir = os.getcwd()
    process_html_files(current_dir, title, desc, keywords, ga_id)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Cancelled by user!")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")