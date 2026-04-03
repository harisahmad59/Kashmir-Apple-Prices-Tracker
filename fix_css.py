with open('c:/Users/haris/Downloads/Kashmir-Apple-Prices-Tracker/style.css', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Fix any weird zero-bytes or overlaps if they exist
content = content.replace('\x00', '')

# Make sure we rewrite it fully normalized as UTF-8
with open('c:/Users/haris/Downloads/Kashmir-Apple-Prices-Tracker/style.css', 'w', encoding='utf-8') as f:
    f.write(content)
print("done rewriting")
