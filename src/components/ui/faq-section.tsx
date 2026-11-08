'use client';

import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function FAQs() {
  const faqItems = [
    {
      id: 'item-1',
      question: 'How do I list my Discord server on ConnectingERLC?',
      answer: 'Sign in with your Discord account, select any community where you have Administrator or Manage Server permissions, fill out your description, tags, and invite link, and save. Your server immediately appears in the public directory and showcase.',
    },
    {
      id: 'item-2',
      question: 'How does the Earn Credits directory work?',
      answer: 'Members join listed communities and maintain membership to receive credit bounties (+2 credits per verified join). Server owners can spend their balance to bump their community to the #1 spot in the directory or fund recruit campaigns.',
    },
    {
      id: 'item-3',
      question: 'What is server bumping and how does the cooldown work?',
      answer: 'Bumping elevates your community to the top of the directory and public showcase. Bumping requires credits and includes a fair single-bump cooldown window to ensure equal visibility for all servers.',
    },
    {
      id: 'item-4',
      question: 'How does the ER:LC / PRC integration work?',
      answer: 'By providing your Police Roleplay Community server API key in server settings, ConnectingERLC automatically synchronizes live player counts, queue status, and join codes directly to your listing and member cards.',
    },
    {
      id: 'item-5',
      question: 'How do cross-community partnerships work?',
      answer: 'Server owners can browse verified partner communities, review terms (minimum members, allowed mentions, and fee), and submit mutual exchange requests that automatically post to partner broadcast channels upon approval.',
    },
    {
      id: 'item-6',
      question: 'Is ConnectingERLC free to use?',
      answer: 'Yes! Basic directory listing, discovery, community management, and credit earning are free. You earn credits organically by participating in community joins and growth campaigns.',
    },
  ];

  return (
    <section className="py-16 md:py-24 border-t border-white/[0.06] bg-[#0A0A0C]">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-8 md:grid-cols-5 md:gap-12">
          <div className="md:col-span-2">
            <h2 className="text-white text-3xl sm:text-4xl font-semibold tracking-tight font-sans">FAQs</h2>
            <p className="text-zinc-400 mt-4 text-balance text-base sm:text-lg font-sans">Your questions answered</p>
            <p className="text-zinc-400 mt-6 hidden md:block text-sm font-sans">
              Can't find what you're looking for? Contact our{' '}
              <a
                href="https://discord.gg/central"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] font-medium hover:underline"
              >
                customer support team
              </a>
            </p>
          </div>

          <div className="md:col-span-3">
            <Accordion
              type="single"
              collapsible
              className="w-full space-y-1"
            >
              {faqItems.map((item) => (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className="border-b border-white/[0.08]"
                >
                  <AccordionTrigger className="cursor-pointer text-[15px] font-medium text-zinc-200 hover:text-[var(--accent)] hover:no-underline text-left py-4">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-zinc-400 font-sans leading-relaxed pb-4 pt-1">
                    <p>{item.answer}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <p className="text-zinc-400 mt-6 md:hidden text-sm font-sans">
            Can't find what you're looking for? Contact our{' '}
            <a
              href="https://discord.gg/central"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] font-medium hover:underline"
            >
              customer support team
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

export default FAQs;

