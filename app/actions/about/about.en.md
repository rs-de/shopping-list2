Recently I run errands for my family and when I arrived at the supermarket I opened some other shopping list app I used so far and I got an error "No articles found".
I do not know why, but for some reason the app logged my out, and I was not able to login again. What the hack? I was lost without the list since we used to do one shopping per week and there where a lot of articles on the list, and since my wife is adding the articles to the list, I did not know what to buy!
Long story short, the shopping was a mess, and a lot of time was wasted on that day.

### Why do I have to login to create a shopping list?

As long as we do shoppings by our self many of us create shopping lists on paper.
Since **it is just a peace of paper**, every one would be able to add/remove/change articles on it.
It is obvious, we can use our mobile device for such a use case.
Since I'm a web application developer, I decided to create one with following requirements (for ever):

- No login/registration required
- No personal data required
- No tracking
- No ads
- No cookies
- Free to use
- Open source
- Simple as possible
- Easy to use
- Cross platform (web, mobile, desktop)
- Multi language support (currently English and German)

### How does it work?

#### Access to a list

In order to make a shopping list only available to the person who created it, a globally unique identifier is used to identify the list.
Such an id looks like this: 14d77b4e62117ad749890c6d. Because there are so many possible combinations, it is close to impossible to guess a valid id.
And even it is known by a stranger, what kind of data he will get? Only a list of some articles ... so what?

#### Creation of a list

In order to avoid potential flooding of the database with new lists the creation of a list is rate limited.
We can only create one List within 5 seconds. For all users. This does not scale, but it is enough for now.

#### Other user data

Since the list id is the only data we need to identify a list, there is no need for any other data from the user.
The app does not set cookies and does not need any data form the user agent (your device or browser).

#### Source code of the app

The source code of the app is public available on github, linked in footer of this page.

### What I hope

- This is something useful, and we can just use it without any hassle.
- It will not be abused by bots or other people.
- There is enough spare time, to maintain it.

### What I get

I coupled the key motivation as described above with some new technologies I wanted to try out.
As a web application developer it just makes much more fun to build something and learn new technologies while doing so.

### Why did I add the "Buy me a coffee" button?

I used so much open source in my career, that I was happy to be able to give something back for some projects I used.
(See my blog: [Thank you open source](https://www.rushsoft.de/blog/thank-you-open-source) ).
I do not expect any donations, but if you like the app, and you want to give something back, feel free to do so. :-)
