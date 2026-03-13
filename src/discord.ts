export async function sendDiscordDM(botToken: string, userId: string, message: string): Promise<boolean> {
  try {
    // Create DM channel
    const channelResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient_id: userId }),
    })

    const channel = await channelResponse.json() as { id?: string }
    if (!channel.id) return false

    // Send message
    const messageResponse = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: message }),
    })

    // Add delay to avoid rate limits (1 message per second)
    await new Promise(resolve => setTimeout(resolve, 1000))

    return messageResponse.ok
  } catch (error) {
    console.error('Discord DM error:', error)
    return false
  }
}

export function formatItemAlert(item: any): string {
  const enhancives = JSON.parse(item.enhancives_json)
  const enhText = enhancives.map((e: any) => `+${e.boost} ${e.ability}`).join(', ')
  
  return `🔔 **New Enhancive Match!**

**${item.name}**
Town: ${item.town}
Shop: ${item.shop}
Cost: ${item.cost?.toLocaleString() || 'N/A'} silvers
Slot: ${item.worn || 'N/A'}
Enhancives: ${enhText}

View at: https://shops.elanthia.online`
}
