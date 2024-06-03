export const getCaPrompt = (prompt: string) => {
	return ` Check the prompt below. I want you to find out if there is a cryptocurrency address there. You must return one word. Either the contreact address or null.

Examples:
Prompt 1: "What is the market cap of 0xAadcB3b14BD9D0d04AAB03AdA882Bea698Aa1638"

This prompt should return strictly "0xAadcB3b14BD9D0d04AAB03AdA882Bea698Aa1638"

Reason: Because that is the cryptocurrency address in the prompt

Example 2: "How are you"?
This prompt should strictly return "null"

Reason: There is no cryptocurrency address associated with the prompt.

Remember to strictly return just either the crypto address, or null. 

Below is the prompt
${prompt}`;
};

export const getamountprompt = (
	prompt: string,
) => ` Check the prompt below. I want you to find out if there is an amount there either in eth tokens or in us dollars. You must return one word. Either the amount or null.

Examples:
Prompt 1: "buy $100 worth of token"

This prompt should return strictly "$100"

Reason: it has an amount in usd

Example 2: "get me 0.01eth worth"?
This prompt should strictly return "0.01eth"

Reason: it has an amount in eth.

Example 3: "buy this token for me"
This prompt should strictly return "null"

Reason: there is no amount present.

Example 4: "i want to buy 30 dollars worth"
this prompt should return "$30"

Reason: it has "30 dollars present"

Example 5: "i want to buy 3 Ethereum worth"
this prompt should return "3eth"

Reason: it has an amount 3 etheruem present

Example 6:"55usd"
this prompt should return "$55"

Reason:it has 55 usd present

Remember to strictly return just either the amount, or null. 

Below is the prompt
${prompt}`;

//const intentionPrompt = `Check if this ${text} expresses intention to buy a token,
//if it does that reply this message with "buy", you just reply with one word "buy"`;
export const getBuyPrompt = (
	prompt: string,
) => ` Check the prompt below. I want you to find out if it expresses intention to buy a token,  if it does return "buy"
	You must return one word. Either the "buy" or "null". 

Examples:
Prompt 1: "buy this"

This prompt should return strictly "buy"

Reason: it has buy in it indication willingness to buy a token previously mentioned

Example 2: "i want to pruchase this"?
This prompt should strictly return "buy"

Reason: it has purchase in it.

Example 3: "tell me about this token"
This prompt should strictly return "null"

Reason: it asks for information not willingness to buy.

Example 4: "thank you"
This prompt should strictly return "null"

Reason: it does not indicate willingness to buy.

Remember, it has to contain buy or a synonym of buy. 
strictly return just "buy" or "null". 

Below is the prompt
${prompt}`;

export const getSellPrompt = (
	prompt: string,
) => ` Check the prompt below. I want you to find out if it expresses intention to sell a token,  if it does return "sell"
    You must return one word. Either "sell" or "null". 

Examples:
Prompt 1: "sell this"

This prompt should return strictly "sell"

Reason: it has sell in it, indicating willingness to sell a token previously mentioned.

Example 2: "i want to get rid of this"?
This prompt should strictly return "sell"

Reason: it indicates a desire to dispose of the token, which implies selling.

Example 3: "tell me about this token"
This prompt should strictly return "null"

Reason: it asks for information, not willingness to sell.

Example 4: "thank you"
This prompt should strictly return "null"

Reason: it does not indicate willingness to sell.

Remember, it has to contain sell or a synonym of sell. 
Strictly return just "sell" or "null". 

Below is the prompt
${prompt}`;
export const getTimePrompt = (
	prompt: string,
) => ` Check the prompt below. I want you to find out if it contains a unit of time,  if it does return the time in milliseconds
    You must return one word. Either time in or "null". 

Examples:
Prompt 1: "i want to buy this in 1 hour"

This prompt should return strictly "3600000"

Reason: it has 1 hour in it.

Example 2: "i want to sell this in 1 day"?
This prompt should strictly return "86400000 "

Reason: the number of miliseconds in a day is 86400000 .

Example 3: "tell me about this token"
This prompt should strictly return "null"

Reason: it asks for information, no mention of time.

Example 4: "thank you"
This prompt should strictly return "null"

Reason: no mention of time.

Remember, it has to contain a unit of time be it minutes, hours, or a day. 
Strictly return just "{time in miliseconds}" or "null". 

Below is the prompt
${prompt}`;

export const getsellamountprompt = (
	prompt: string,
) => ` Check the prompt below. I want you to find out if there is a percentage less than or equal to 100 in it. You must return one word. Either the percentage or null.

Examples:
Prompt 1: "sell 50 % worth of token"

This prompt should return strictly "50"

Reason: it has a percentage

Example 2: "sell 10 percent"?
This prompt should strictly return "10"

Reason: it has a percentage.

Example 3: "sell this token for me"
This prompt should strictly return "null"

Reason: there is no percentage present.

Example 4: "i want to sell 30 dollars worth"
this prompt should return "null"

Reason: it has no percentage present"

Example 5: "i want to sell 101% worth"
this prompt should return "null"

Reason: the percentage is above 100"

Example 6: "i want to sell 150% worth"
this prompt should return "null"

Reason: the percentage is above 100"

Remember to strictly return just either the amount, or null. 

Below is the prompt
${prompt}`;
